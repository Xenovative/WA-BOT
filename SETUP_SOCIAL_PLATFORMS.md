# Social Media Platforms Setup Guide

This guide will help you set up Instagram and Facebook Messenger integration with WA-BOT.

## Overview

WA-BOT now supports the following platforms:
- ✅ **WhatsApp** (via whatsapp-web.js)
- ✅ **Telegram** (via official Bot API)
- 🆕 **Facebook Messenger** (via official Messenger Platform API)
- 🆕 **Instagram** (via official Instagram Basic Display API + Private API fallback)

## Facebook Messenger Setup

### Prerequisites
- Facebook Developer Account
- Facebook Page for your business
- SSL certificate (required for webhooks)

### Step 1: Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App" → "Business" → "Next"
3. Enter app name and contact email
4. Add "Messenger" product to your app

### Step 2: Configure Messenger
1. In Messenger settings, add your Facebook Page
2. Generate a Page Access Token
3. Set up webhooks:
   - Webhook URL: `https://yourdomain.com/webhook/facebook`
   - Verify Token: Create a custom token (save this)
   - Subscribe to: `messages`, `messaging_postbacks`, `message_deliveries`

### Step 3: Environment Variables
Add to your `.env` file:
```bash
FACEBOOK_PAGE_ACCESS_TOKEN=your_facebook_page_access_token
FACEBOOK_VERIFY_TOKEN=your_custom_verify_token
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### Step 4: Webhook Verification
1. Start your WA-BOT server
2. In Facebook Developer Console, verify your webhook
3. The webhook should be verified successfully

## Instagram Setup

### Option 1: Official Instagram Basic Display API (Recommended)

#### Prerequisites
- Facebook Developer Account
- Instagram Business Account
- SSL certificate (required for webhooks)

#### Step 1: Create Facebook App
1. Use the same app from Facebook Messenger setup, or create a new one
2. Add "Instagram Basic Display" product
3. Add "Instagram Messaging" if available

#### Step 2: Configure Instagram API
1. In Instagram Basic Display settings:
   - Add your Instagram Business Account
   - Generate an Access Token
   - Set up webhooks:
     - Webhook URL: `https://yourdomain.com/webhook/instagram`
     - Verify Token: Create a custom token
     - Subscribe to: `messages`, `messaging_postbacks`

#### Step 3: Environment Variables
Add to your `.env` file:
```bash
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_VERIFY_TOKEN=your_custom_verify_token
INSTAGRAM_APP_SECRET=your_instagram_app_secret
```

### Option 2: Instagram Private API (Fallback)

⚠️ **Warning**: This method uses an unofficial API and may violate Instagram's Terms of Service. Use at your own risk.

#### Step 1: Environment Variables
Add to your `.env` file:
```bash
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password
IG_PROXY=  # Optional proxy URL
```

#### Step 2: Account Requirements
- Use a dedicated Instagram account for the bot
- Enable two-factor authentication is NOT recommended for bot accounts
- Consider using a proxy to avoid IP restrictions

## Installation

### Install Dependencies
```bash
npm install axios instagram-private-api
```

### Update Your Environment
Copy the new variables from `.env.example` to your `.env` file and configure them according to the setup guides above.

## Testing

### Test Facebook Messenger
1. Send a message to your Facebook Page
2. Check the console logs for incoming messages
3. Verify AI responses are working

### Test Instagram
1. Send a direct message to your Instagram account
2. Check the console logs for incoming messages
3. Verify AI responses are working

## Webhook URLs

Make sure your server is accessible via HTTPS and configure these webhook URLs:

- **Facebook Messenger**: `https://yourdomain.com/webhook/facebook`
- **Instagram**: `https://yourdomain.com/webhook/instagram`

## Manual Message Sending

The GUI now supports sending manual messages to all platforms:

1. Open the Chat History tab
2. Click on any chat from Facebook or Instagram
3. Use the manual intervention feature to send messages
4. Toggle AI responses on/off as needed

## Platform Detection

The system automatically detects platforms based on chat ID format:
- WhatsApp: `85290897701@c.us`
- Telegram: `telegram:123456789`
- Facebook: `facebook:123456789`
- Instagram: `instagram:123456789`

## Troubleshooting

### Facebook Messenger Issues
- **Webhook verification fails**: Check your FACEBOOK_VERIFY_TOKEN matches
- **Messages not received**: Verify webhook subscriptions include `messages`
- **Can't send messages**: Check FACEBOOK_PAGE_ACCESS_TOKEN is valid

### Instagram Issues
- **Official API not working**: Try the Private API fallback
- **Private API login fails**: Check username/password, consider using proxy
- **Rate limiting**: Instagram has strict rate limits, reduce message frequency

### General Issues
- **SSL certificate required**: Both Facebook and Instagram require HTTPS webhooks
- **Firewall/NAT**: Ensure your server is accessible from the internet
- **Environment variables**: Double-check all required variables are set

## Security Considerations

1. **Keep tokens secure**: Never commit API tokens to version control
2. **Use environment variables**: Store all sensitive data in `.env` file
3. **Webhook verification**: Always verify webhook signatures
4. **Rate limiting**: Implement rate limiting to avoid API restrictions
5. **Account security**: Use dedicated accounts for bot operations

## API Limits

### Facebook Messenger
- 1000 messages per day for standard access
- Higher limits available with app review

### Instagram
- Official API: Limited to business accounts
- Private API: Unofficial limits, use with caution

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify your environment variables are correct
3. Test webhook connectivity with tools like ngrok
4. Review Facebook/Instagram developer documentation

## Next Steps

- Set up proper SSL certificates for production
- Apply for higher API limits if needed
- Implement additional features like rich media support
- Add analytics and monitoring
