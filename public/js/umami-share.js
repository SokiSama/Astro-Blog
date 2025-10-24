(function (global) {
  const cacheKey = 'umami-share-cache';
  const cacheTTL = 3600_000; // 1h

  /**
   * 获取网站统计数据
   * @param {string} baseUrl - Umami Cloud API基础URL
   * @param {string} apiKey - API密钥
   * @param {string} websiteId - 网站ID
   * @returns {Promise<object>} 网站统计数据
   */
  async function fetchWebsiteStats(baseUrl, apiKey, websiteId) {
    // 检查缓存
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheTTL) {
          return parsed.value;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }
    
    const currentTimestamp = Date.now();
    const statsUrl = `${baseUrl}/v1/websites/${websiteId}/stats?startAt=0&endAt=${currentTimestamp}`;
    
    const res = await fetch(statsUrl, {
      headers: {
        'x-umami-api-key': apiKey
      }
    });
    
    if (!res.ok) {
      throw new Error('获取网站统计数据失败');
    }
    
    const stats = await res.json();
    
    // 缓存结果
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), value: stats }));
    
    return stats;
  }

  /**
   * 获取特定页面的统计数据（按 URL 聚合）
   * @param {string} baseUrl - Umami Cloud API基础URL
   * @param {string} apiKey - API密钥
   * @param {string} websiteId - 网站ID
   * @param {string} urlPath - 页面路径
   * @param {number} startAt - 开始时间戳
   * @param {number} endAt - 结束时间戳
   * @returns {Promise<object>} 页面统计数据 { pageviews: number, visitors: number }
   */
  async function fetchPageStats(baseUrl, apiKey, websiteId, urlPath, startAt = 0, endAt = Date.now()) {
    // 使用 metrics 接口按 URL 聚合，返回各 URL 的 pageviews
    const metricsUrl = `${baseUrl}/v1/websites/${websiteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=url`;
    const res = await fetch(metricsUrl, {
      headers: {
        'x-umami-api-key': apiKey
      }
    });
    
    if (!res.ok) {
      throw new Error('获取页面统计数据失败');
    }
    
    const data = await res.json(); // 形如 [{ x: '/posts/foo', y: 123 }, ...]
    const normalize = (p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    };
    const target = normalize(urlPath);
    const candidates = new Set([target, target.replace(/\/$/, '')]);
    let pageviews = 0;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item.x === 'string') {
          const x = normalize(item.x);
          if (candidates.has(x) || candidates.has(x.replace(/\/$/, ''))) {
            pageviews = Number(item.y || 0);
            break;
          }
        }
      }
    }
    // visitors 按 URL 无官方 v1 统计，暂设为 0
    return { pageviews, visitors: 0 };
  }

  /**
   * 获取 Umami 网站统计数据
   * @param {string} baseUrl - Umami Cloud API基础URL
   * @param {string} apiKey - API密钥
   * @param {string} websiteId - 网站ID
   * @returns {Promise<object>} 网站统计数据
   */
  global.getUmamiWebsiteStats = async function (baseUrl, apiKey, websiteId) {
    try {
      return await fetchWebsiteStats(baseUrl, apiKey, websiteId);
    } catch (err) {
      throw new Error(`获取Umami统计数据失败: ${err.message}`);
    }
  };

  /**
   * 获取特定页面的 Umami 统计数据
   * @param {string} baseUrl - Umami Cloud API基础URL
   * @param {string} apiKey - API密钥
   * @param {string} websiteId - 网站ID
   * @param {string} urlPath - 页面路径
   * @param {number} startAt - 开始时间戳（可选）
   * @param {number} endAt - 结束时间戳（可选）
   * @returns {Promise<object>} 页面统计数据
   */
  global.getUmamiPageStats = async function (baseUrl, apiKey, websiteId, urlPath, startAt, endAt) {
    try {
      return await fetchPageStats(baseUrl, apiKey, websiteId, urlPath, startAt, endAt);
    } catch (err) {
      throw new Error(`获取Umami页面统计数据失败: ${err.message}`);
    }
  };

  global.clearUmamiShareCache = function () {
    localStorage.removeItem(cacheKey);
  };
})(window);