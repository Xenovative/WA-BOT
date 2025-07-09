/**
 * Handles time/date related queries
 * @param {string} message - The message text to check for time/date queries
 * @returns {string|null} - Response if it's a time/date query, null otherwise
 */
function handleTimeDateQuery(message) {
  // Set timezone to Hong Kong for all date operations
  const hongKongTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });
  const now = new Date(hongKongTime);
  
  // Format options for different languages
  const timeOptions = {
    en: { 
      timeZone: 'Asia/Hong_Kong',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    },
    zh: {
      timeZone: 'Asia/Hong_Kong',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    },
    yue: {
      timeZone: 'Asia/Hong_Kong',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      numberingSystem: 'hant'
    }
  };

  // Check for time/date related keywords in different languages
  const timeRegex = /(time|what(?:'s| is) the time|what time is it(?: now)?|\b(?:now|current) time\b|幾點(?:鐘)?|而家(?:係)?幾點(?:鐘)?|現在(?:是)?幾點(?:鐘)?|宜家幾多點|而家幾多點|現在幾多點)/i;
  const dateRegex = /(date|what(?:'s| is) (?:today'?s?|the) date|today is|what day is (?:today|it)|幾號|今日(?:係|是)?(?:幾多|咩)?(?:號|日子)|星期幾|今日(?:係|是)?(?:星期|週|禮拜)|而家(?:係|是)?(?:星期|週|禮拜))/i;
  
  const isTimeQuery = timeRegex.test(message);
  const isDateQuery = dateRegex.test(message);
  
  if (!isTimeQuery && !isDateQuery) return null;
  
  // Format responses based on language and query type
  const responses = {
    en: {
      time: () => {
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Hong_Kong'
        });
        return `It's currently ${timeStr} (Hong Kong Time)`;
      },
      date: () => {
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Hong_Kong'
        });
        return `Today is ${dateStr} (Hong Kong Time)`;
      },
      day: () => {
        const dayStr = now.toLocaleDateString('en-US', {
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong'
        });
        return `Today is ${dayStr} (Hong Kong Time)`;
      },
      dateNum: () => {
        const dateStr = now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Hong_Kong'
        });
        return `Today's date is ${dateStr} (Hong Kong Time)`;
      },
      both: () => {
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Hong_Kong'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Hong_Kong'
        });
        return `It's currently ${timeStr} on ${dateStr} (Hong Kong Time)`;
      }
    },
    zh: {
      time: () => {
        const timeStr = now.toLocaleTimeString('zh-Hant', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Hong_Kong'
        });
        return `現在時間是 ${timeStr} (香港時間)`;
      },
      date: () => {
        const dateStr = now.toLocaleDateString('zh-Hant', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong'
        });
        return `今天是 ${dateStr} (香港時間)`;
      },
      day: () => {
        const dayStr = now.toLocaleDateString('zh-Hant', {
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong'
        });
        return `今天是${dayStr} (香港時間)`;
      },
      dateNum: () => {
        const dateStr = now.toLocaleDateString('zh-Hant', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Hong_Kong'
        });
        return `今天是 ${dateStr} (香港時間)`;
      },
      both: () => {
        const dateStr = now.toLocaleDateString('zh-Hant', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong'
        });
        const timeStr = now.toLocaleTimeString('zh-Hant', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Hong_Kong'
        });
        return `現在是 ${dateStr} ${timeStr} (香港時間)`;
      }
    },
    yue: {
      time: () => {
        const timeStr = now.toLocaleTimeString('yue-HK', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Hong_Kong',
          numberingSystem: 'hant'
        });
        return `而家係 ${timeStr} (香港時間)`;
      },
      date: () => {
        const dateStr = now.toLocaleDateString('yue-HK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong',
          numberingSystem: 'hant'
        });
        return `今日係 ${dateStr} (香港時間)`;
      },
      day: () => {
        const dayStr = now.toLocaleDateString('yue-HK', {
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong',
          numberingSystem: 'hant'
        });
        return `今日係${dayStr} (香港時間)`;
      },
      dateNum: () => {
        const dateStr = now.toLocaleDateString('yue-HK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Hong_Kong',
          numberingSystem: 'hant'
        });
        return `今日係 ${dateStr} (香港時間)`;
      },
      both: () => {
        const dateStr = now.toLocaleDateString('yue-HK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          timeZone: 'Asia/Hong_Kong',
          numberingSystem: 'hant'
        });
        const timeStr = now.toLocaleTimeString('yue-HK', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Hong_Kong',
          numberingSystem: 'hant'
        });
        return `而家係 ${dateStr} ${timeStr} (香港時間)`;
      }
    }
  };
  
  // Detect language based on message content
  let lang = 'en';
  if (/[\u4e00-\u9fff]/.test(message)) {
    lang = /(廣東話|粵語|yue|hk|cantonese)/i.test(message) ? 'yue' : 'zh';
  }
  
  // Determine response type based on query
  let responseType = 'both';
  
  if (isTimeQuery && isDateQuery) {
    responseType = 'both';
  } else if (isTimeQuery) {
    responseType = 'time';
  } else if (/星期|週|禮拜|星期幾/.test(message)) {
    responseType = 'day';
  } else if (/幾號|號數|日期/.test(message)) {
    responseType = 'dateNum';
  } else {
    responseType = 'date';
  }
  
  // Get and return the appropriate response
  return responses[lang][responseType]();
}

/**
 * Parse a duration string into milliseconds
 * @param {string} durationStr - Duration string (e.g., '30m', '2h', '1d')
 * @returns {number} Duration in milliseconds
 * @throws {Error} If the format is invalid
 */
function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([smhd])?$/i);
  if (!match) {
    throw new Error('Invalid duration format');
  }
  
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  
  const multipliers = {
    's': 1000,          // seconds
    'm': 60 * 1000,     // minutes
    'h': 60 * 60 * 1000, // hours
    'd': 24 * 60 * 60 * 1000 // days
  };
  
  if (!(unit in multipliers)) {
    throw new Error(`Invalid time unit: ${unit}. Use s, m, h, or d`);
  }
  
  return value * multipliers[unit];
}

module.exports = { 
  handleTimeDateQuery,
  parseDuration 
};
