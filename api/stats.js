// 使用 Neon PostgreSQL 数据库
import { Pool } from '@neondatabase/serverless';

// 创建数据库连接池
const pool = new Pool({ connectionString: process.env.NETLIFY_DATABASE_URL });

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'GET, OPTIONS' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // 检查数据库连接字符串
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.error('错误: NETLIFY_DATABASE_URL 环境变量未设置');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '数据库配置错误' }),
    };
  }

  const client = await pool.connect();
  try {
    console.log('开始查询统计数据...');
    
    // 先检查表是否存在
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'photos'
      )
    `);
    console.log('photos表存在:', tableCheck.rows[0].exists);
    
    // 实时统计实际数据
    const [usersResult, photosResult, downloadsResult] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM users'),
      client.query("SELECT COUNT(*) as count FROM photos WHERE status = 'approved'"),
      client.query('SELECT SUM(download_count) as count FROM photos')
    ]);
    
    console.log('查询结果:', {
      users: usersResult.rows[0],
      photos: photosResult.rows[0],
      downloads: downloadsResult.rows[0]
    });
    
    const totalUsers = parseInt(usersResult.rows[0]?.count) || 0;
    const totalPhotos = parseInt(photosResult.rows[0]?.count) || 0;
    const totalDownloads = parseInt(downloadsResult.rows[0]?.count) || 0;
    
    console.log('统计数据:', { totalUsers, totalPhotos, totalDownloads });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalUsers,
        totalPhotos,
        totalDownloads,
      }),
    };
  } catch (error) {
    console.error('获取统计错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        totalUsers: 0,
        totalPhotos: 0,
        totalDownloads: 0,
      }),
    };
  } finally {
    client.release();
  }
}
