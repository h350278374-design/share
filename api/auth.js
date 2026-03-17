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
      case 'register':
        return await register(body, headers);
      case 'login':
        return await login(body, headers);
      case 'change-password':
        return await changePassword(body, headers);
      case 'reset-password':
        return await resetPassword(body, headers);
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '无效的操作' }),
        };
    }
  } catch (error) {
    console.error('认证错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器错误: ' + error.message }),
    };
  }
}

async function register(body, headers) {
  const { username, password } = body;
  
  // 去除用户名前后空格
  const trimmedUsername = username ? username.trim() : '';
  
  if (!trimmedUsername || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '账号和密码不能为空' }),
    };
  }

  // 验证账号格式（admin账号除外）
  if (trimmedUsername.toLowerCase() !== 'admin') {
    const usernameRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '账号必须为字母加数字组合' }),
      };
    }
  }

  // 验证密码长度
  if (password.length < 6) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '密码不少于6位' }),
    };
  }

  const client = await pool.connect();
  try {
    // 检查用户名是否已存在
    const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [trimmedUsername]);
    if (existingUser.rows.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '账号已存在，请选择其他账号' }),
      };
    }

    // 创建新用户
    await client.query(
      'INSERT INTO users (username, password, points, uploads, downloads) VALUES ($1, $2, $3, $4, $5)',
      [trimmedUsername, password, 0, 0, 0]
    );

    // 更新统计
    await client.query('UPDATE stats SET total_users = total_users + 1 WHERE id = 1');

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        message: '注册成功',
        user: {
          username: trimmedUsername,
          points: 0,
          uploads: 0,
          downloads: 0,
        }
      }),
    };
  } catch (error) {
    throw new Error('注册失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function login(body, headers) {
  const { username, password } = body;
  
  // 去除用户名前后空格
  const trimmedUsername = username ? username.trim() : '';
  
  if (!trimmedUsername || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '账号和密码不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [trimmedUsername]);
    
    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '账号或密码错误' }),
      };
    }

    const user = result.rows[0];
    
    if (user.password !== password) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '账号或密码错误' }),
      };
    }

    // 更新最后登录时间
    await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = $1', [trimmedUsername]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: '登录成功',
        user: {
          username: user.username,
          points: user.points,
          uploads: user.uploads,
          downloads: user.downloads,
        },
      }),
    };
  } catch (error) {
    throw new Error('登录失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function changePassword(body, headers) {
  const { username, oldPassword, newPassword } = body;
  
  // 去除用户名前后空格
  const trimmedUsername = username ? username.trim() : '';
  
  if (!trimmedUsername || !oldPassword || !newPassword) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '请填写所有密码字段' }),
    };
  }

  if (newPassword.length < 6) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '新密码不少于6位' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [trimmedUsername]);
    
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '用户不存在' }),
      };
    }

    const user = result.rows[0];
    
    if (user.password !== oldPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '原密码错误' }),
      };
    }

    await client.query('UPDATE users SET password = $1 WHERE username = $2', [newPassword, trimmedUsername]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '密码修改成功' }),
    };
  } catch (error) {
    throw new Error('修改密码失败: ' + error.message);
  } finally {
    client.release();
  }
}

async function resetPassword(body, headers) {
  const { username, adminPassword } = body;
  
  // 去除用户名前后空格
  const trimmedUsername = username ? username.trim() : '';
  
  if (!trimmedUsername) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '用户名不能为空' }),
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [trimmedUsername]);
    
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '用户不存在' }),
      };
    }

    // 重置密码为账号名（初始密码）
    await client.query('UPDATE users SET password = $1 WHERE username = $2', [trimmedUsername, trimmedUsername]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: `密码已重置为: ${trimmedUsername}`,
        password: trimmedUsername
      }),
    };
  } catch (error) {
    throw new Error('重置密码失败: ' + error.message);
  } finally {
    client.release();
  }
}
