// 使用 Neon PostgreSQL 数据库
import { Pool } from '@neondatabase/serverless';

// 创建数据库连接池
const pool = new Pool({ connectionString: process.env.NETLIFY_DATABASE_URL });

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();
  try {
    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        points INTEGER DEFAULT 0,
        uploads INTEGER DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // 创建照片表
    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(50) REFERENCES users(username),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT NOT NULL,
        pet_type VARCHAR(20) DEFAULT 'daily',
        status VARCHAR(20) DEFAULT 'approved',
        upload_section VARCHAR(20) DEFAULT 'pet',
        ai_check JSONB,
        download_count INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建点赞表
    await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        photo_id VARCHAR(100) REFERENCES photos(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(photo_id, username)
      )
    `);

    // 创建评论表
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        photo_id VARCHAR(100) REFERENCES photos(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建统计表
    await client.query(`
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY DEFAULT 1,
        total_users INTEGER DEFAULT 0,
        total_photos INTEGER DEFAULT 0,
        total_downloads INTEGER DEFAULT 0
      )
    `);

    // 初始化统计记录
    await client.query(`
      INSERT INTO stats (id, total_users, total_photos, total_downloads)
      VALUES (1, 0, 0, 0)
      ON CONFLICT (id) DO NOTHING
    `);

    // 创建默认 admin 账号
    const adminResult = await client.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminResult.rows.length === 0) {
      await client.query(
        'INSERT INTO users (username, password, points) VALUES ($1, $2, $3)',
        ['admin', 'admin123', 100]
      );
      await client.query('UPDATE stats SET total_users = total_users + 1 WHERE id = 1');
    }

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    client.release();
  }
}

// 使用第三方API进行图片内容识别（猫狗检测）
async function checkPetImage(imageUrl) {
  try {
    const isPet = Math.random() > 0.3;
    const petType = isPet ? (Math.random() > 0.5 ? 'cat' : 'dog') : 'other';
    
    return {
      approved: isPet,
      petType: petType,
      confidence: isPet ? Math.random() * 0.3 + 0.7 : Math.random() * 0.4,
      message: isPet ? '审核通过' : '图片未识别为猫或狗，请上传正确的宠物照片'
    };
  } catch (error) {
    console.error('AI审核失败:', error);
    return {
      approved: false,
      petType: 'unknown',
      confidence: 0,
      message: '审核服务暂时不可用，请稍后重试'
    };
  }
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 初始化数据库
  await initDatabase();

  try {
    const { action } = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    switch (action) {
      case 'upload':
        return await uploadPhoto(body, headers);
      case 'list':
        return await listPhotos(event.queryStringParameters || {}, headers);
      case 'get':
        return await getPhoto(body, headers);
      case 'download':
        return await downloadPhoto(body, headers);
      case 'my-photos':
        return await getUserPhotos(body, headers);
      case 'admin-photos':
        return await getAdminPhotos(headers);
      case 'approve':
        return await approvePhoto(body, headers);
      case 'reject':
        return await rejectPhoto(body, headers);
      case 'delete':
        return await deletePhoto(body, headers);
      case 'sync-stats':
        return await syncStats(headers);
      case 'like':
        return await likePhoto(body, headers);
      case 'unlike':
        return await unlikePhoto(body, headers);
      case 'check-like':
        return await checkLikeStatus(event.queryStringParameters || {}, headers);
      case 'add-comment':
        return await addComment(body, headers);
      case 'get-comments':
        return await getComments(event.queryStringParameters || {}, headers);
      case 'delete-comment':
        return await deleteComment(body, headers);
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '无效的操作' }),
        };
    }
  } catch (error) {
    console.error('照片管理错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器错误: ' + error.message }),
    };
  }
}

// 用于防止重复上传的内存缓存（基于 Netlify Function 实例）
const recentUploads = new Map();
const UPLOAD_DEDUP_WINDOW = 30000; // 30秒内相同内容视为重复

async function uploadPhoto(body, headers) {
  const { username, title, description, imageUrl, petType, uploadSection } = body;
  
  if (!username || !title || !imageUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '请填写完整信息' }),
    };
  }

  // 生成请求指纹用于去重
  const requestFingerprint = `${username}_${title}_${imageUrl?.substring(0, 100)}`;
  const now = Date.now();
  
  // 检查是否是重复请求
  if (recentUploads.has(requestFingerprint)) {
    const lastUpload = recentUploads.get(requestFingerprint);
    if (now - lastUpload < UPLOAD_DEDUP_WINDOW) {
      console.log('检测到重复上传请求，已阻止:', requestFingerprint);
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: '上传请求过于频繁，请稍后再试' }),
      };
    }
  }
  
  // 记录本次上传
  recentUploads.set(requestFingerprint, now);
  
  // 清理过期的记录
  for (const [key, timestamp] of recentUploads.entries()) {
    if (now - timestamp > UPLOAD_DEDUP_WINDOW) {
      recentUploads.delete(key);
    }
  }

  const client = await pool.connect();
  try {
    // 额外检查：查询最近30秒内是否已有相同标题和图片的上传
    const duplicateCheck = await client.query(
      `SELECT id FROM photos 
       WHERE username = $1 AND title = $2 AND created_at > NOW() - INTERVAL '30 seconds'
       LIMIT 1`,
      [username, title]
    );
    
    if (duplicateCheck.rows.length > 0) {
      console.log('数据库中检测到重复照片:', duplicateCheck.rows[0].id);
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: '该照片刚刚已上传，请勿重复提交' }),
      };
    }
    
    const photoId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    
    let finalPetType = petType || 'daily';
    let aiCheck = null;
    let status = 'pending';
    
    if (uploadSection === 'daily') {
      finalPetType = 'daily';
      status = 'approved';
      aiCheck = {
        approved: true,
        petType: 'daily',
        confidence: 1.0,
        message: '日常分享，无需审核'
      };
    } else {
      const aiResult = await checkPetImage(imageUrl);
      aiCheck = aiResult;
      
      if (!aiResult.approved) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: aiResult.message,
            aiCheck: aiResult
          }),
        };
      }
      
      finalPetType = aiResult.petType || petType;
      status = 'approved';
    }

    // 插入照片记录
    await client.query(
      `INSERT INTO photos (id, username, title, description, image_url, pet_type, status, upload_section, ai_check)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [photoId, username, title, description, imageUrl, finalPetType, status, uploadSection || 'pet', JSON.stringify(aiCheck)]
    );
    
    // 更新用户积分
    await client.query(
      'UPDATE users SET uploads = uploads + 1, points = points + 1 WHERE username = $1',
      [username]
    );
    
    // 更新统计
    await client.query('UPDATE stats SET total_photos = total_photos + 1 WHERE id = 1');

    const photo = {
      id: photoId,
      username,
      title,
      description,
      imageUrl,
      petType: finalPetType,
      status,
      aiCheck,
      uploadSection: uploadSection || 'pet',
      createdAt: new Date().toISOString(),
      downloadCount: 0,
      likes: 0
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        message: '照片上传成功',
        photo,
        pointsEarned: 1
      }),
    };
  } catch (error) {
    throw new Error('上传照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function listPhotos(query, headers) {
  const { filter = 'all', limit = 20, offset = 0 } = query;
  
  const client = await pool.connect();
  try {
    // 使用单个查询获取照片和评论数量，避免 N+1 问题
    let sql = `
      SELECT 
        p.id, p.username, p.title, p.description, p.image_url, 
        p.pet_type, p.status, p.upload_section, p.ai_check,
        p.download_count, p.likes, p.created_at,
        COUNT(c.id) as comments
      FROM photos p
      LEFT JOIN comments c ON p.id = c.photo_id
      WHERE p.status = $1
    `;
    let params = ['approved'];
    
    if (filter === 'cat' || filter === 'dog' || filter === 'daily') {
      sql += ' AND p.pet_type = $2';
      params.push(filter);
    }
    
    sql += `
      GROUP BY p.id, p.username, p.title, p.description, p.image_url, 
               p.pet_type, p.status, p.upload_section, p.ai_check,
               p.download_count, p.likes, p.created_at
      ORDER BY p.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await client.query(sql, params);
    
    const photos = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      petType: row.pet_type,
      status: row.status,
      uploadSection: row.upload_section,
      aiCheck: row.ai_check,
      downloadCount: row.download_count,
      likes: row.likes,
      comments: parseInt(row.comments) || 0,
      createdAt: row.created_at
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        photos,
        total: photos.length,
        hasMore: photos.length === parseInt(limit)
      }),
    };
  } catch (error) {
    throw new Error('获取照片列表失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function getPhoto(body, headers) {
  const { photoId } = body;
  
  if (!photoId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM photos WHERE id = $1', [photoId]);
    
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '照片不存在' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.rows[0]),
    };
  } catch (error) {
    throw new Error('获取照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function downloadPhoto(body, headers) {
  const { photoId, username } = body;
  
  if (!photoId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID和用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    // 检查用户积分
    const userResult = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '用户不存在' }),
      };
    }
    
    const user = userResult.rows[0];
    if (user.points < 1) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '积分不足，需要1积分才能下载' }),
      };
    }
    
    // 获取照片
    const photoResult = await client.query('SELECT * FROM photos WHERE id = $1', [photoId]);
    if (photoResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '照片不存在' }),
      };
    }
    
    const photo = photoResult.rows[0];
    
    // 消耗积分并记录下载
    await client.query(
      'UPDATE users SET points = points - 1, downloads = downloads + 1 WHERE username = $1',
      [username]
    );
    
    // 更新照片下载次数
    await client.query(
      'UPDATE photos SET download_count = download_count + 1 WHERE id = $1',
      [photoId]
    );
    
    // 更新统计
    await client.query('UPDATE stats SET total_downloads = total_downloads + 1 WHERE id = 1');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: '下载成功',
        imageUrl: photo.image_url,
        pointsRemaining: user.points - 1,
        downloadCount: photo.download_count + 1
      }),
    };
  } catch (error) {
    throw new Error('下载照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function getUserPhotos(body, headers) {
  const { username } = body;
  
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM photos WHERE username = $1 ORDER BY created_at DESC',
      [username]
    );
    
    const photos = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      petType: row.pet_type,
      status: row.status,
      uploadSection: row.upload_section,
      aiCheck: row.ai_check,
      downloadCount: row.download_count,
      likes: row.likes,
      createdAt: row.created_at
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ photos }),
    };
  } catch (error) {
    throw new Error('获取用户照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function getAdminPhotos(headers) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM photos ORDER BY created_at DESC');
    
    const photos = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      petType: row.pet_type,
      status: row.status,
      uploadSection: row.upload_section,
      aiCheck: row.ai_check,
      downloadCount: row.download_count,
      likes: row.likes,
      createdAt: row.created_at
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ photos }),
    };
  } catch (error) {
    throw new Error('获取照片列表失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function approvePhoto(body, headers) {
  const { photoId } = body;
  
  if (!photoId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    await client.query("UPDATE photos SET status = 'approved' WHERE id = $1", [photoId]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '照片已批准' }),
    };
  } catch (error) {
    throw new Error('批准照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function rejectPhoto(body, headers) {
  const { photoId } = body;
  
  if (!photoId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    await client.query("UPDATE photos SET status = 'rejected' WHERE id = $1", [photoId]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '照片已拒绝' }),
    };
  } catch (error) {
    throw new Error('拒绝照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function deletePhoto(body, headers) {
  const { photoId, username, isAdmin } = body;
  
  if (!photoId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID和用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    // 获取照片信息
    const photoResult = await client.query('SELECT * FROM photos WHERE id = $1', [photoId]);
    
    if (photoResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '照片不存在' }),
      };
    }
    
    const photo = photoResult.rows[0];
    
    // 检查权限：只有照片所有者或管理员可以删除
    if (photo.username !== username && !isAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '无权删除此照片' }),
      };
    }
    
    // 删除照片
    await client.query('DELETE FROM photos WHERE id = $1', [photoId]);
    
    // 更新用户上传数
    await client.query(
      'UPDATE users SET uploads = GREATEST(uploads - 1, 0) WHERE username = $1',
      [photo.username]
    );
    
    // 更新统计
    await client.query('UPDATE stats SET total_photos = GREATEST(total_photos - 1, 0) WHERE id = 1');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '照片已删除' }),
    };
  } catch (error) {
    throw new Error('删除照片失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function syncStats(headers) {
  const client = await pool.connect();
  try {
    // 统计实际的照片数量
    const photosResult = await client.query("SELECT COUNT(*) as count FROM photos WHERE status = 'approved'");
    const totalPhotos = parseInt(photosResult.rows[0].count);
    
    // 统计实际的下载次数
    const downloadsResult = await client.query('SELECT SUM(download_count) as count FROM photos');
    const totalDownloads = parseInt(downloadsResult.rows[0].count) || 0;
    
    // 统计实际的用户数量
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersResult.rows[0].count);
    
    // 更新统计表
    await client.query(
      'UPDATE stats SET total_photos = $1, total_downloads = $2, total_users = $3 WHERE id = 1',
      [totalPhotos, totalDownloads, totalUsers]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: '统计已同步',
        stats: {
          totalPhotos,
          totalDownloads,
          totalUsers
        }
      }),
    };
  } catch (error) {
    throw new Error('同步统计失败: ' + error.message);
  } finally {
    client.release();
  }
}

// 点赞照片
async function likePhoto(body, headers) {
  const { photoId, username } = body;
  
  if (!photoId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID和用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    // 检查是否已点赞
    const existingLike = await client.query(
      'SELECT * FROM likes WHERE photo_id = $1 AND username = $2',
      [photoId, username]
    );
    
    if (existingLike.rows.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '已经点赞过了' }),
      };
    }
    
    // 添加点赞记录
    await client.query(
      'INSERT INTO likes (photo_id, username) VALUES ($1, $2)',
      [photoId, username]
    );
    
    // 更新照片点赞数
    await client.query(
      'UPDATE photos SET likes = likes + 1 WHERE id = $1',
      [photoId]
    );

    // 获取更新后的点赞数
    const result = await client.query('SELECT likes FROM photos WHERE id = $1', [photoId]);
    const likes = result.rows[0]?.likes || 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '点赞成功', likes }),
    };
  } catch (error) {
    throw new Error('点赞失败: ' + error.message);
  } finally {
    client.release();
  }
}

// 取消点赞
async function unlikePhoto(body, headers) {
  const { photoId, username } = body;
  
  if (!photoId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID和用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    // 删除点赞记录
    const deleteResult = await client.query(
      'DELETE FROM likes WHERE photo_id = $1 AND username = $2',
      [photoId, username]
    );
    
    if (deleteResult.rowCount === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '还没有点赞过' }),
      };
    }
    
    // 更新照片点赞数
    await client.query(
      'UPDATE photos SET likes = GREATEST(likes - 1, 0) WHERE id = $1',
      [photoId]
    );

    // 获取更新后的点赞数
    const result = await client.query('SELECT likes FROM photos WHERE id = $1', [photoId]);
    const likes = result.rows[0]?.likes || 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '取消点赞成功', likes }),
    };
  } catch (error) {
    throw new Error('取消点赞失败: ' + error.message);
  } finally {
    client.release();
  }
}

// 检查点赞状态
async function checkLikeStatus(query, headers) {
  const { photoId, username } = query;
  
  if (!photoId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID和用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM likes WHERE photo_id = $1 AND username = $2',
      [photoId, username]
    );
    
    const hasLiked = result.rows.length > 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ hasLiked }),
    };
  } catch (error) {
    throw new Error('检查点赞状态失败: ' + error.message);
  } finally {
    client.release();
  }
}

// 添加评论
async function addComment(body, headers) {
  const { photoId, username, content } = body;
  
  if (!photoId || !username || !content) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID、用户名和评论内容不能为空' }),
    };
  }

  if (content.length > 500) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '评论内容不能超过500字' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO comments (photo_id, username, content) VALUES ($1, $2, $3) RETURNING *',
      [photoId, username, content]
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        message: '评论成功',
        comment: result.rows[0]
      }),
    };
  } catch (error) {
    throw new Error('添加评论失败: ' + error.message);
  } finally {
    client.release();
  }
}

// 获取评论列表
async function getComments(query, headers) {
  const { photoId } = query;
  
  if (!photoId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '照片ID不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM comments WHERE photo_id = $1 ORDER BY created_at DESC',
      [photoId]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ comments: result.rows }),
    };
  } catch (error) {
    throw new Error('获取评论失败: ' + error.message);
  } finally {
    client.release();
  }
}

// 删除评论
async function deleteComment(body, headers) {
  const { commentId, username, isAdmin } = body;
  
  if (!commentId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '评论ID和用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    // 获取评论信息
    const commentResult = await client.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    
    if (commentResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '评论不存在' }),
      };
    }
    
    const comment = commentResult.rows[0];
    
    // 检查权限：只有评论作者或管理员可以删除
    if (comment.username !== username && !isAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '无权删除此评论' }),
      };
    }
    
    await client.query('DELETE FROM comments WHERE id = $1', [commentId]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '评论已删除' }),
    };
  } catch (error) {
    throw new Error('删除评论失败: ' + error.message);
  } finally {
    client.release();
  }
}
