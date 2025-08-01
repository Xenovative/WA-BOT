// Internationalization system for WhatsXENO
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.fallbackLanguage = 'en';
        this.loadTranslations();
        this.detectLanguage();
    }

    // Load all translations
    loadTranslations() {
        // English (default)
        this.translations.en = {
            // Navigation
            'nav.dashboard': 'Dashboard',
            'nav.chats': 'Chats',
            'nav.platforms': 'Platforms',
            'nav.workflows': 'Workflows',
            'nav.settings': 'Settings',
            'nav.logs': 'Logs',
            'nav.triggers': 'Triggers',
            'nav.knowledge_base': 'Knowledge Base',
            'nav.commands': 'Command History',
            'nav.system': 'System',
            
            // Knowledge Base
            'kb.title': 'Knowledge Base Documents',
            'kb.no_documents': 'No documents found in knowledge base',
            'kb.failed_load': 'Failed to load knowledge base',
            'kb.filename': 'Filename',
            'kb.size': 'Size',
            'kb.chunks': 'Chunks',
            'kb.uploaded': 'Uploaded',
            'kb.use_in_rag': 'Use in RAG',
            'kb.actions': 'Actions',
            'kb.enabled': 'Enabled',
            'kb.disabled': 'Disabled',
            'kb.delete': 'Delete',
            'kb.delete_confirm': 'Are you sure you want to delete',
            'kb.document_deleted': 'Document deleted successfully',
            'kb.delete_failed': 'Delete failed',
            'kb.document_enabled': 'enabled for RAG operations',
            'kb.document_disabled': 'disabled for RAG operations',
            'kb.toggle_failed': 'Failed to toggle document status',
            
            // System
            'system.title': 'System Information',
            'system.restart_server': 'Restart Server',
            'system.environment': 'Environment',
            'system.nodejs_version': 'Node.js Version',
            'system.platform': 'Platform',
            'system.cpu': 'CPU',
            'system.uptime': 'Uptime',
            'system.show_branding': 'Show Branding',
            'system.show_whatsxeno_logo': 'Show WhatsXENO Logo & Favicon',
            'system.memory_usage': 'Memory Usage',
            'system.rss': 'RSS',
            'system.heap_total': 'Heap Total',
            'system.heap_used': 'Heap Used',
            'system.external': 'External',
            'system.gpu_info': 'GPU Information',
            'system.loading_gpu': 'Loading GPU information...',
            'system.model': 'Model',
            'system.vendor': 'Vendor',
            'system.vram': 'VRAM',
            'system.driver': 'Driver',
            'system.unknown': 'Unknown',
            
            // Buttons
            'button.close': 'Close',
            'button.refresh_qr': 'Refresh QR Code',
            'button.upload_document': 'Upload Document',
            'button.loading_documents': 'Loading documents...',
            
            // QR Code Modal
            'qr.modal_title': 'Scan WhatsApp QR Code',
            'qr.loading': 'Loading QR code...',
            'qr.generating': 'Generating QR code...',
            'qr.scan_instruction': 'Scan the QR code with your WhatsApp mobile app',
            
            // Dashboard
            'dashboard.title': 'WhatsXENO Management Console',
            'dashboard.status': 'Status',
            'dashboard.online': 'Online',
            'dashboard.offline': 'Offline',
            'dashboard.qr_code': 'Scan WhatsApp QR Code',
            'dashboard.telegram_status': 'Telegram Status',
            'dashboard.connected': 'Connected',
            'dashboard.disconnected': 'Disconnected',
            'dashboard.system_health': 'System Health',
            'dashboard.uptime': 'Uptime:',
            'dashboard.heap_used': 'Heap Used:',
            'dashboard.cpu': 'CPU:',
            'dashboard.platform': 'Platform:',
            'dashboard.bot_status': 'Bot Status',
            'dashboard.current_model': 'Current Model',
            'dashboard.rag_status': 'RAG Status',
            'dashboard.provider': 'Provider',
            'dashboard.enabled': 'Enabled',
            'dashboard.disabled': 'Disabled',
            'dashboard.not_set': 'Not set',
            'dashboard.recent_chats': 'Recent Chats',
            
            // Chat History
            'chat.title': 'Chat History',
            'chat.search_placeholder': 'Search chats...',
            'chat.no_chats': 'No chats found',
            'chat.loading': 'Loading chats...',
            'chat.send_message': 'Send Message',
            'chat.message_placeholder': 'Enter your message...',
            'chat.ai_toggle': 'AI Auto Reply',
            'chat.manual_intervention': 'Manual Intervention',
            'chat.view_chat': 'View Chat',
            'chat.last_message': 'Last Message',
            'chat.message_count': 'Message Count',
            'chat.chat_id': 'Chat ID',
            'chat.messages': 'Messages',
            'chat.ai': 'AI',
            'chat.loading_recent': 'Loading recent chats...',
            'chat.view_all': 'View All Chats',
            'chat.preview': 'Preview',
            'chat.last_active': 'Last Active',
            'chat.sort_by': 'Sort by:',
            'chat.newest_first': 'Newest First',
            'chat.oldest_first': 'Oldest First',
            'chat.clear_all': 'Clear All',
            'chat.chat_details': 'Chat Details',
            'chat.refresh_chat': 'Refresh Chat',
            'chat.send': 'Send',
            'chat.manual_message_placeholder': 'Type a message to send manually...',
            'chat.manual_message_help': 'Send messages manually through the bot. AI response depends on the toggle in the chat list.',
            'chat.ai_toggle_label': 'AI:',
            'chat.ai_toggle_on': 'On',
            'chat.ai_toggle_off': 'Off',
            'chat.ai_toggle_help': 'Toggle AI auto-reply for this chat',
            'chat.ai_enabled': 'AI auto-reply enabled for this chat',
            'chat.ai_disabled': 'AI auto-reply disabled for this chat',
            'chat.loading_messages': 'Loading messages...',
            'chat.no_messages': 'No messages in this chat',
            'chat.message_sent': 'Message sent',
            'chat.message_failed': 'Failed to send message',
            'chat.you': 'You',
            'chat.role_user': 'User',
            'chat.role_assistant': 'Assistant',
            'common.updating': 'Updating...',
            'common.sending': 'Sending...',
            
            // Platforms
            'platforms.title': 'Platform Management',
            'platforms.refresh': 'Refresh Status',
            'platforms.whatsapp': 'WhatsApp',
            'platforms.telegram': 'Telegram',
            'platforms.facebook': 'Facebook Messenger',
            'platforms.instagram': 'Instagram',
            'platforms.connection_method': 'Connection Method',
            'platforms.whatsapp_method': 'WhatsApp Web (QR Code)',
            'platforms.telegram_method': 'Bot API Token',
            'platforms.facebook_official': 'Official API (Recommended)',
            'platforms.facebook_easy': 'Easy Setup (Login)',
            'platforms.instagram_official': 'Official API (Business)',
            'platforms.instagram_private': 'Private API (Unofficial)',
            'platforms.instagram_web': 'Web Automation',
            'platforms.bot_token': 'Bot Token',
            'platforms.page_access_token': 'Page Access Token',
            'platforms.verify_token': 'Verify Token',
            'platforms.app_secret': 'App Secret',
            'platforms.access_token': 'Access Token',
            'platforms.email': 'Email',
            'platforms.password': 'Password',
            'platforms.username': 'Username',
            'platforms.auth_method': 'Authentication Method',
            'platforms.login_credentials': 'Login Credentials',
            'platforms.session_id': 'Session ID (Recommended)',
            'platforms.session_help': 'Extract sessionid cookie from browser after logging into Instagram',
            'platforms.instagram_private_info': 'Session ID method is more stable and avoids login challenges.',
            'platforms.connect': 'Connect',
            'platforms.disconnect': 'Disconnect',
            'platforms.facebook_warning': 'Use a dedicated bot account. Avoid 2FA.',
            'platforms.instagram_warning': 'Use a dedicated bot account. Risk of restrictions.',
            'platforms.instagram_web_info': 'Browser automation fallback method.',
            'platforms.status': 'Status',
            'platforms.status.unknown': 'Unknown',
            'platforms.status.not_connected': 'Not connected',
            'platforms.status.connected': 'Connected',
            'platforms.status.disconnected': 'Disconnected',
            'platforms.status.connecting': 'Connecting',
            'platforms.status.error': 'Error',
            'platforms.status_summary': 'Platform Status Summary',
            'platforms.platform': 'Platform',
            'platforms.method': 'Method',
            'platforms.last_activity': 'Last Activity',
            'platforms.actions': 'Actions',
            'platforms.never': 'Never',
            'platforms.connecting_status': 'Connecting...',
            'platforms.connected_success': 'Connected successfully',
            'platforms.connection_failed': 'Connection failed',
            'platforms.disconnected_success': 'Disconnected successfully',
            'platforms.disconnect_failed': 'Disconnect failed',
            'platforms.invalid_credentials': 'Invalid credentials',
            'platforms.configuration_saved': 'Configuration saved',
            'platforms.configuration_failed': 'Failed to save configuration',
            
            // Workflows
            'workflow.title': 'Workflow Management',
            'workflow.upload': 'Upload Workflow',
            'workflow.open_editor': 'Open Workflow Editor',
            'workflow.available': 'Available Workflows',
            'workflow.refresh': 'Refresh',
            'workflow.name': 'Name',
            'workflow.description': 'Description',
            'workflow.status': 'Status',
            'workflow.actions': 'Actions',
            'workflow.no_description': 'No description',
            'workflow.enabled': 'Enabled',
            'workflow.disabled': 'Disabled',
            'workflow.enable': 'Enable',
            'workflow.disable': 'Disable',
            'workflow.view': 'View',
            'workflow.no_workflows': 'No workflows available. Create workflows in the Node-RED editor.',
            'workflow.load_failed': 'Failed to load workflows',
            'workflow.load_error': 'Failed to load workflows: ',
            'workflow.upload_success': 'Workflow uploaded successfully',
            'workflow.upload_error': 'Error uploading workflow',
            'workflow.editor_unavailable': 'Workflow editor is not available',
            
            // Settings
            'settings.title': 'Settings',
            'settings.language': 'Language',
            'settings.theme': 'Theme',
            'settings.notifications': 'Notifications',
            'settings.save': 'Save Settings',
            'settings.reset': 'Reset to Default',
            'settings.saved': 'Settings saved successfully',
            'settings.limited_access': 'You are in limited access mode. Log in as admin to access all features.',
            'settings.bot_settings': 'Bot Settings',
            'settings.changes_immediate': 'Changes will be applied immediately.',
            'settings.config_profiles': 'Configuration Profiles',
            'settings.current_profile': 'Current Profile',
            'settings.select_profile_help': 'Select a profile to load its settings',
            'settings.new_profile_name': 'New Profile Name',
            'settings.enter_profile_name': 'Enter profile name',
            'settings.save_as': 'Save As',
            'settings.save_profile_help': 'Save current settings as a new profile',
            'settings.delete_profile': 'Delete Profile',
            'settings.enable_rag': 'Enable RAG',
            'settings.system_prompt': 'System Prompt',
            'settings.advanced_config': 'Advanced Configuration',
            'settings.show_advanced': 'Show Advanced',
            
            // Common
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.view': 'View',
            'button.refresh': 'Refresh',
            'common.close': 'Close',
            'common.loading': 'Loading...',
            'common.error': 'Error',
            'common.notification': 'Notification',
            'common.success': 'Success',
            'common.warning': 'Warning',
            'common.info': 'Information',
            'common.confirm': 'Confirm',
            'common.yes': 'Yes',
            'common.no': 'No',
            'common.actions': 'Actions',
            'common.add': 'Add',
            'common.delete_chat': 'Delete Chat',
            'common.delete_chat_confirm': 'Are you sure you want to delete this chat history? This action cannot be undone.',
            
            // Messages
            'message.connection_lost': 'Connection lost. Attempting to reconnect...',
            'message.connection_restored': 'Connection restored',
            'message.new_message': 'New message received',
            'message.send_success': 'Message sent successfully',
            'message.send_error': 'Failed to send message',
            
            // Time
            'time.now': 'now',
            'time.minute_ago': 'a minute ago',
            'time.minutes_ago': '{0} minutes ago',
            'time.hour_ago': 'an hour ago',
            'time.hours_ago': '{0} hours ago',
            'time.day_ago': 'a day ago',
            'time.days_ago': '{0} days ago',
            'time.week_ago': 'a week ago',
            'time.weeks_ago': '{0} weeks ago',
            'time.month_ago': 'a month ago',
            'time.months_ago': '{0} months ago',
            'time.year_ago': 'a year ago',
            'time.years_ago': '{0} years ago',
            
            // Buttons
            'button.refresh': 'Refresh',
            'button.upload': 'Upload',
            'button.download': 'Download',
            'button.clear': 'Clear',
            'button.search': 'Search',
            'button.filter': 'Filter',
            'button.sort': 'Sort',
            'button.export': 'Export',
            'button.import': 'Import',
            'button.connect': 'Connect',
            'button.disconnect': 'Disconnect',
            'button.send': 'Send',
            'button.receive': 'Receive',
            'button.admin_login': 'Admin Login',
            'button.logout_admin': 'Logout Admin',
            'admin.modal_title': 'Admin Login',
            'admin.password_label': 'Admin Password',
            'admin.login_button': 'Login',
            
            // Toast Notifications
            'toast.settings_saved': 'Settings saved successfully!',
            'toast.profile_saved': 'Profile saved successfully',
            'toast.profile_loaded': 'Profile loaded successfully',
            'toast.profile_deleted': 'Profile deleted successfully',
            'toast.cannot_delete_default': 'Cannot delete the default profile',
            'toast.enter_profile_name': 'Please enter a profile name',
            'toast.select_profile_delete': 'Please select a profile to delete',
            'toast.server_restarting': 'Server is restarting. Please wait a moment and refresh the page.',
            'toast.chat_deleted': 'Chat deleted successfully',
            'toast.chat_history_cleared': 'All chat history has been cleared',
            'toast.chat_exported': 'Chat exported successfully',
            'toast.triggers_saved': 'Triggers saved successfully',
            'toast.trigger_exists': 'This trigger already exists!',
            'toast.trigger_empty': 'Trigger text cannot be empty',
            'toast.trigger_updated': 'Trigger updated',
            'toast.refreshing_triggers': 'Refreshing triggers...',
            'toast.failed_load_triggers': 'Failed to load triggers',
            'toast.failed_save_triggers': 'Failed to save triggers',
            'toast.no_chat_open': 'Error: No chat currently open',
            'toast.chat_refreshed': 'Chat refreshed successfully',
            'toast.ai_enabled': 'AI enabled for chat',
            'toast.ai_disabled': 'AI disabled for chat',
            'toast.message_sent': 'Message sent successfully',
            'toast.error_prefix': 'Error: ',
            'toast.failed_prefix': 'Failed to ',
            
            // Commands
            'commands.title': 'Command History',
            'commands.recent': 'Recent Commands',
            'commands.time': 'Time',
            'commands.sender': 'Sender',
            'commands.command': 'Command',
            'commands.arguments': 'Arguments',
            
            // Triggers
            'triggers.title': 'Bot Triggers',
            'triggers.description': 'Configure words or phrases that will trigger the bot to respond in group chats.',
            'triggers.group_chat': 'Group Chat Triggers',
            'triggers.group_help': 'These words will activate the bot in group chats when mentioned anywhere in a message.',
            'triggers.add_trigger': 'Add new trigger word...',
            'triggers.case_insensitive_help': 'Triggers are case-insensitive. The bot will respond if any of these words appear in a message.',
            'triggers.custom': 'Custom Triggers',
            'triggers.custom_help': 'Add custom triggers for specific use cases.',
            'triggers.add_custom': 'Add new custom trigger...',
            'triggers.save': 'Save Triggers',
            
            // System
            'system.title': 'System Information',
            'system.restart_server': 'Restart Server'
        };

        // Traditional Chinese (繁體中文)
        this.translations['zh-TW'] = {
            // Navigation
            'nav.dashboard': '儀表板',
            'nav.chats': '聊天記錄',
            'nav.platforms': '平台',
            'nav.workflows': '工作流程',
            'nav.settings': '設定',
            'nav.logs': '日誌',
            'nav.triggers': '觸發器',
            'nav.knowledge_base': '知識庫',
            'nav.commands': '指令歷史',
            'nav.system': '系統',
            
            // Knowledge Base (Traditional Chinese)
            'kb.title': '知識庫文件',
            'kb.no_documents': '知識庫中找不到文件',
            'kb.failed_load': '載入知識庫失敗',
            'kb.filename': '檔案名稱',
            'kb.size': '大小',
            'kb.chunks': '區塊',
            'kb.uploaded': '上傳時間',
            'kb.use_in_rag': '用於 RAG',
            'kb.actions': '操作',
            'kb.enabled': '已啟用',
            'kb.disabled': '已停用',
            'kb.delete': '刪除',
            'kb.delete_confirm': '您確定要刪除',
            'kb.document_deleted': '文件刪除成功',
            'kb.delete_failed': '刪除失敗',
            'kb.document_enabled': '已啟用 RAG 操作',
            'kb.document_disabled': '已停用 RAG 操作',
            'kb.toggle_failed': '切換文件狀態失敗',
            
            // Dashboard
            'dashboard.title': 'WhatsXENO 管理控制台',
            'dashboard.status': '狀態',
            'dashboard.online': '線上',
            'dashboard.offline': '離線',
            'dashboard.qr_code': '掃描 WhatsApp QR 碼',
            'dashboard.telegram_status': 'Telegram 狀態',
            'dashboard.connected': '已連接',
            'dashboard.disconnected': '已斷開',
            'dashboard.system_health': '系統狀態',
            'dashboard.uptime': '運行時間：',
            'dashboard.heap_used': '堆積使用：',
            'dashboard.cpu': 'CPU：',
            'dashboard.platform': '平台：',
            'dashboard.bot_status': '機器人狀態',
            'dashboard.current_model': '目前模型',
            'dashboard.rag_status': 'RAG 狀態',
            'dashboard.provider': '提供者',
            'dashboard.enabled': '已啟用',
            'dashboard.disabled': '已停用',
            'dashboard.not_set': '未設定',
            'dashboard.recent_chats': '最近聊天',
            
            // Chat History
            'chat.title': '聊天記錄',
            'chat.search_placeholder': '搜尋聊天...',
            'chat.no_chats': '找不到聊天記錄',
            'chat.loading': '載入聊天中...',
            'chat.send_message': '發送訊息',
            'chat.message_placeholder': '輸入您的訊息...',
            'chat.ai_toggle': 'AI 自動回覆',
            'chat.manual_intervention': '手動介入',
            'chat.view_chat': '查看聊天',
            'chat.last_message': '最後訊息',
            'chat.message_count': '訊息數量',
            'chat.chat_id': '聊天 ID',
            'chat.messages': '訊息',
            'chat.ai': 'AI',
            'chat.ai_toggle_on': '開啟',
            'chat.ai_toggle_off': '關閉',
            'chat.ai_toggle_help': '切換此聊天的AI自動回覆',
            'chat.ai_enabled': '已為此聊天啟用AI自動回覆',
            'chat.ai_disabled': '已為此聊天停用AI自動回覆',
            'chat.chat_details': '聊天詳情',
            'chat.refresh_chat': '刷新聊天',
            'chat.send': '發送',
            'chat.manual_message_placeholder': '輸入要發送的手動消息...',
            'chat.manual_message_help': '通過機器人手動發送消息。AI回覆取決於聊天列表中的切換狀態。',
            'chat.ai_toggle_label': 'AI:',
            'chat.loading_messages': '載入消息中...',
            'chat.no_messages': '此聊天沒有消息',
            'chat.發送消息': 'Message sent',
            'chat.發送失敗': 'Failed to send message',
            'chat.you': '你',
            'chat.role_user': '用戶',
            'chat.role_assistant': '助手',
            'chat.loading_recent': '載入最近聊天中...',
            'chat.view_all': '查看所有聊天',
            'chat.preview': '預覽',
            'chat.last_active': '最後活動',
            'chat.sort_by': '排序方式：',
            'chat.newest_first': '最新優先',
            'chat.oldest_first': '最舊優先',
            'chat.clear_all': '清除所有',
            
            // Workflows
            'workflow.title': '工作流程管理',
            'workflow.open_editor': '開啟工作流程編輯器',
            'workflow.upload': '上傳工作流程',
            'workflow.no_workflows': '找不到工作流程',
            'workflow.upload_success': '工作流程上傳成功',
            'workflow.upload_error': '工作流程上傳錯誤',
            'workflow.editor_unavailable': '工作流程編輯器不可用',
            
            // Settings
            'settings.title': '設定',
            'settings.language': '語言',
            'settings.theme': '主題',
            'settings.notifications': '通知',
            'settings.save': '儲存設定',
            'settings.reset': '重設為預設值',
            'settings.saved': '設定儲存成功',
            'settings.limited_access': '您目前為限制存取模式。請以管理員身份登入以存取所有功能。',
            'settings.bot_settings': '機器人設定',
            'settings.changes_immediate': '更改將立即生效。',
            'settings.config_profiles': '配置檔案',
            'settings.current_profile': '目前檔案',
            'settings.select_profile_help': '選擇檔案以載入其設定',
            'settings.new_profile_name': '新檔案名稱',
            'settings.enter_profile_name': '輸入檔案名稱',
            'settings.save_as': '另存為',
            'settings.save_profile_help': '將目前設定儲存為新檔案',
            'settings.delete_profile': '刪除檔案',
            'settings.enable_rag': '啟用 RAG',
            'settings.system_prompt': '系統提示',
            'settings.advanced_config': '進階配置',
            'settings.show_advanced': '顯示進階選項',
            
            // Common
            'common.save': '儲存',
            'common.cancel': '取消',
            'common.delete': '刪除',
            'common.edit': '編輯',
            'common.view': '查看',
            'common.close': '關閉',
            'common.loading': '載入中...',
            'common.error': '錯誤',
            'common.success': '成功',
            'common.warning': '警告',
            'common.info': '資訊',
            'common.confirm': '確認',
            'common.yes': '是',
            'common.no': '否',
            'common.actions': '操作',
            
            // Messages
            'message.connection_lost': '連接中斷。正在嘗試重新連接...',
            'message.connection_restored': '連接已恢復',
            'message.new_message': '收到新訊息',
            'message.send_success': '訊息發送成功',
            'message.send_error': '訊息發送失敗',
            
            // Time
            'time.now': '剛剛',
            'time.minute_ago': '1分鐘前',
            'time.minutes_ago': '{0}分鐘前',
            'time.hour_ago': '1小時前',
            'time.hours_ago': '{0}小時前',
            'time.day_ago': '1天前',
            'time.days_ago': '{0}天前',
            'time.week_ago': '1週前',
            'time.weeks_ago': '{0}週前',
            'time.month_ago': '1個月前',
            'time.months_ago': '{0}個月前',
            'time.year_ago': '1年前',
            'time.years_ago': '{0}年前',
            
            // Buttons
            'button.refresh': '重新整理',
            'button.upload': '上傳',
            'button.download': '下載',
            'button.clear': '清除',
            'button.search': '搜尋',
            'button.filter': '篩選',
            'button.sort': '排序',
            'button.export': '匯出',
            'button.import': '匯入',
            'button.connect': '連接',
            'button.disconnect': '斷開',
            'button.send': '發送',
            'button.receive': '接收',
            'button.admin_login': '管理員登入',
            'button.logout_admin': '登出管理員',
            'admin.modal_title': '管理員登入',
            'admin.password_label': '管理員密碼',
            'admin.login_button': '登入',
            
            // Toast Notifications (Traditional Chinese)
            'toast.settings_saved': '設定儲存成功！',
            'toast.profile_saved': '配置檔儲存成功',
            'toast.profile_loaded': '配置檔載入成功',
            'toast.profile_deleted': '配置檔刪除成功',
            'toast.cannot_delete_default': '無法刪除預設配置檔',
            'toast.enter_profile_name': '請輸入配置檔名稱',
            'toast.select_profile_delete': '請選擇要刪除的配置檔',
            'toast.server_restarting': '伺服器正在重新啟動。請稍候並重新整理頁面。',
            'toast.chat_deleted': '聊天記錄刪除成功',
            'toast.chat_history_cleared': '所有聊天記錄已清除',
            'toast.chat_exported': '聊天記錄匯出成功',
            'toast.triggers_saved': '觸發器儲存成功',
            'toast.trigger_exists': '此觸發器已存在！',
            'toast.trigger_empty': '觸發器文字不能為空',
            'toast.trigger_updated': '觸發器已更新',
            'toast.refreshing_triggers': '正在重新整理觸發器...',
            'toast.failed_load_triggers': '載入觸發器失敗',
            'toast.failed_save_triggers': '儲存觸發器失敗',
            'toast.no_chat_open': '錯誤：目前沒有開啟的聊天',
            'toast.chat_refreshed': '聊天記錄重新整理成功',
            'toast.ai_enabled': '聊天 AI 已啟用',
            'toast.ai_disabled': '聊天 AI 已停用',
            'toast.message_sent': '訊息傳送成功',
            'toast.error_prefix': '錯誤：',
            'toast.failed_prefix': '失敗：',
            
            // Commands
            'commands.title': '指令歷史',
            'commands.recent': '最近指令',
            'commands.time': '時間',
            'commands.sender': '發送者',
            'commands.command': '指令',
            'commands.arguments': '參數',
            
            // Triggers
            'triggers.title': '機器人觸發器',
            'triggers.description': '配置在群組聊天中觸發機器人回應的字詞或短語。',
            'triggers.group_chat': '群組聊天觸發器',
            'triggers.group_help': '這些字詞在訊息中任何地方被提及時將激活群組聊天中的機器人。',
            'triggers.add_trigger': '新增觸發器字詞...',
            'triggers.case_insensitive_help': '觸發器不區分大小寫。如果訊息中出現任何這些字詞，機器人將會回應。',
            'triggers.custom': '自定義觸發器',
            'triggers.custom_help': '為特定用途新增自定義觸發器。',
            'triggers.add_custom': '新增自定義觸發器...',
            'triggers.save': '儲存觸發器',
            
            // System
            'system.title': '系統資訊',
            'system.restart_server': '重啟伺服器',
            'system.environment': '環境',
            'system.nodejs_version': 'Node.js 版本',
            'system.platform': '平台',
            'system.cpu': '處理器',
            'system.uptime': '運行時間',
            'system.show_branding': '顯示品牌',
            'system.show_whatsxeno_logo': '顯示 WhatsXENO 標誌與圖示',
            'system.memory_usage': '記憶體使用',
            'system.rss': '常駐記憶體',
            'system.heap_total': '堆積總量',
            'system.heap_used': '已使用堆積',
            'system.external': '外部記憶體',
            'system.gpu_info': 'GPU 資訊',
            'system.loading_gpu': '載入 GPU 資訊中...',
            'system.model': '型號',
            'system.vendor': '供應商',
            'system.vram': '顯示記憶體',
            'system.driver': '驅動程式',
            'system.unknown': '未知',
            
            // Platforms (Traditional Chinese)
            'platforms.title': '平台管理',
            'platforms.refresh': '重新整理狀態',
            'platforms.whatsapp': 'WhatsApp',
            'platforms.telegram': 'Telegram',
            'platforms.facebook': 'Facebook Messenger',
            'platforms.instagram': 'Instagram',
            'platforms.connection_method': '連接方式',
            'platforms.whatsapp_method': 'WhatsApp Web（QR 碼）',
            'platforms.telegram_method': '機器人 API 權杖',
            'platforms.facebook_official': '官方 API（推薦）',
            'platforms.facebook_easy': '簡易設定（登入）',
            'platforms.instagram_official': '官方 API（商業帳號）',
            'platforms.instagram_private': '私人 API（非官方）',
            'platforms.instagram_web': '網頁自動化',
            'platforms.bot_token': '機器人權杖',
            'platforms.page_access_token': '頁面存取權杖',
            'platforms.verify_token': '驗證權杖',
            'platforms.app_secret': '應用程式密鑰',
            'platforms.access_token': '存取權杖',
            'platforms.email': '電子郵件',
            'platforms.password': '密碼',
            'platforms.username': '使用者名稱',
            'platforms.auth_method': '驗證方式',
            'platforms.login_credentials': '登入憑證',
            'platforms.session_id': '工作階段 ID（推薦）',
            'platforms.session_help': '從瀏覽器登入 Instagram 後提取 sessionid Cookie',
            'platforms.instagram_private_info': '工作階段 ID 方法更穩定，避免登入挑戰。',
            'platforms.connect': '連接',
            'platforms.disconnect': '斷開連接',
            'platforms.facebook_warning': '使用專用機器人帳號。避免雙重驗證。',
            'platforms.instagram_warning': '使用專用機器人帳號。有限制風險。',
            'platforms.instagram_web_info': '瀏覽器自動化備用方法。',
            'platforms.status': '狀態',
            'platforms.status.unknown': '未知',
            'platforms.status.not_connected': '未連接',
            'platforms.status.connected': '已連接',
            'platforms.status.disconnected': '已斷開',
            'platforms.status.connecting': '連接中',
            'platforms.status.error': '錯誤',
            'platforms.status_summary': '平台狀態摘要',
            'platforms.platform': '平台',
            'platforms.method': '方式',
            'platforms.last_activity': '最後活動',
            'platforms.actions': '操作',
            'platforms.never': '從未',
            'platforms.connecting_status': '連接中...',
            'platforms.connected_success': '連接成功',
            'platforms.connection_failed': '連接失敗',
            'platforms.disconnected_success': '斷開連接成功',
            'platforms.disconnect_failed': '斷開連接失敗',
            'platforms.invalid_credentials': '無效憑證',
            'platforms.configuration_saved': '配置已儲存',
            'platforms.configuration_failed': '儲存配置失敗',
            
            // Workflows (Traditional Chinese)
            'workflow.title': '工作流程管理',
            'workflow.upload': '上傳工作流程',
            'workflow.open_editor': '開啟工作流程編輯器',
            'workflow.available': '可用工作流程',
            'workflow.refresh': '重新整理',
            'workflow.name': '名稱',
            'workflow.description': '描述',
            'workflow.status': '狀態',
            'workflow.actions': '操作',
            'workflow.no_description': '無描述',
            'workflow.enabled': '已啟用',
            'workflow.disabled': '已停用',
            'workflow.enable': '啟用',
            'workflow.disable': '停用',
            'workflow.view': '檢視',
            'workflow.no_workflows': '無可用工作流程。請在 Node-RED 編輯器中建立工作流程。',
            'workflow.load_failed': '載入工作流程失敗',
            'workflow.load_error': '載入工作流程失敗：',
            
            // Buttons (Traditional Chinese)
            'button.close': '關閉',
            'button.refresh_qr': '重新整理 QR 碼',
            'button.upload_document': '上傳文件',
            'button.loading_documents': '載入文件中...',
            
            // QR Code Modal (Traditional Chinese)
            'qr.modal_title': '掃描 WhatsApp QR 碼',
            'qr.loading': '載入 QR 碼中...',
            'qr.generating': '生成 QR 碼中...',
            'qr.scan_instruction': '使用您的 WhatsApp 手機應用程式掃描 QR 碼',
            
            // Common (additional)
            'common.add': '新增',
            'common.delete_chat': '刪除聊天',
            'common.delete_chat_confirm': '您確定要刪除這個聊天記錄嗎？此操作無法復原。',
            'common.notification': '通知'
        };

        // Simplified Chinese (简体中文)
        this.translations['zh-CN'] = {
            // Navigation
            'nav.dashboard': '仪表板',
            'nav.chats': '聊天记录',
            'nav.platforms': '平台',
            'nav.workflows': '工作流程',
            'nav.settings': '设置',
            'nav.logs': '日志',
            'nav.triggers': '触发器',
            'nav.knowledge_base': '知识库',
            'nav.commands': '命令历史',
            'nav.system': '系统',
            
            // Knowledge Base (Simplified Chinese)
            'kb.title': '知识库文件',
            'kb.no_documents': '知识库中找不到文件',
            'kb.failed_load': '加载知识库失败',
            'kb.filename': '文件名',
            'kb.size': '大小',
            'kb.chunks': '块',
            'kb.uploaded': '上传时间',
            'kb.use_in_rag': '用于 RAG',
            'kb.actions': '操作',
            'kb.enabled': '已启用',
            'kb.disabled': '已停用',
            'kb.delete': '删除',
            'kb.delete_confirm': '您确定要删除',
            'kb.document_deleted': '文件删除成功',
            'kb.delete_failed': '删除失败',
            'kb.document_enabled': '已启用 RAG 操作',
            'kb.document_disabled': '已停用 RAG 操作',
            'kb.toggle_failed': '切换文件状态失败',
            
            // Dashboard
            'dashboard.title': 'WhatsXENO 管理控制台',
            'dashboard.status': '状态',
            'dashboard.online': '在线',
            'dashboard.offline': '离线',
            'dashboard.qr_code': '扫描 WhatsApp 二维码',
            'dashboard.telegram_status': 'Telegram 状态',
            'dashboard.connected': '已连接',
            'dashboard.disconnected': '已断开',
            'dashboard.system_health': '系统状态',
            'dashboard.uptime': '运行时间：',
            'dashboard.heap_used': '堆积使用：',
            'dashboard.cpu': 'CPU：',
            'dashboard.platform': '平台：',
            'dashboard.bot_status': '机器人状态',
            'dashboard.current_model': '当前模型',
            'dashboard.rag_status': 'RAG 状态',
            'dashboard.provider': '提供者',
            'dashboard.enabled': '已启用',
            'dashboard.disabled': '已停用',
            'dashboard.not_set': '未设定',
            'dashboard.recent_chats': '最近聊天',
            
            // Chat History
            'chat.title': '聊天记录',
            'chat.search_placeholder': '搜索聊天...',
            'chat.no_chats': '未找到聊天记录',
            'chat.loading': '加载聊天中...',
            'chat.send_message': '发送消息',
            'chat.message_placeholder': '输入您的消息...',
            'chat.ai_toggle': 'AI 自动回复',
            'chat.manual_intervention': '手动干预',
            'chat.view_chat': '查看聊天',
            'chat.last_message': '最后消息',
            'chat.message_count': '消息数量',
            'chat.chat_id': '聊天 ID',
            'chat.messages': '消息',
            'chat.ai': 'AI',
            'chat.ai_toggle_on': '开启',
            'chat.ai_toggle_off': '关闭',
            'chat.ai_toggle_help': '切换此聊天的AI自动回复',
            'chat.ai_enabled': '已为此聊天启用AI自动回复',
            'chat.ai_disabled': '已为此聊天禁用AI自动回复',
            'chat.role_user': '用户',
            'chat.role_assistant': '助手',
            'chat.chat_details': '聊天详情',
            'chat.refresh_chat': '刷新聊天',
            'chat.send': '发送',
            'chat.manual_message_placeholder': '输入要发送的手动消息...',
            'chat.manual_message_help': '通过机器人手动发送消息。AI回复取决于聊天列表中的切换状态。',
            'chat.you': '你',
            'chat.ai_toggle_label': 'AI:',
            'chat.loading_messages': '加载消息中...',
            'chat.no_messages': '此聊天没有消息',
            'chat.message_sent': '消息已发送',
            'chat.message_failed': '发送消息失败',
            'chat.loading_recent': '加载最近聊天中...',
            'chat.view_all': '查看所有聊天',
            'chat.preview': '预览',
            'chat.last_active': '最后活动',
            'chat.sort_by': '排序方式：',
            'chat.newest_first': '最新优先',
            'chat.oldest_first': '最旧优先',
            'chat.clear_all': '清除所有',
            
            // Workflows
            'workflow.title': '工作流程管理',
            'workflow.open_editor': '打开工作流程编辑器',
            'workflow.upload': '上传工作流程',
            'workflow.no_workflows': '未找到工作流程',
            'workflow.upload_success': '工作流程上传成功',
            'workflow.upload_error': '工作流程上传错误',
            'workflow.editor_unavailable': '工作流程编辑器不可用',
            
            // Settings
            'settings.title': '设置',
            'settings.language': '语言',
            'settings.theme': '主题',
            'settings.notifications': '通知',
            'settings.save': '保存设置',
            'settings.reset': '重置为默认值',
            'settings.saved': '设置保存成功',
            'settings.limited_access': '您目前为限制访问模式。请以管理员身份登入以访问所有功能。',
            'settings.bot_settings': '机器人设置',
            'settings.changes_immediate': '更改将立即生效。',
            'settings.config_profiles': '配置文件',
            'settings.current_profile': '当前文件',
            'settings.select_profile_help': '选择文件以加载其设置',
            'settings.new_profile_name': '新文件名称',
            'settings.enter_profile_name': '输入文件名称',
            'settings.save_as': '另存为',
            'settings.save_profile_help': '将当前设置保存为新文件',
            'settings.delete_profile': '删除文件',
            'settings.enable_rag': '启用 RAG',
            'settings.system_prompt': '系统提示',
            'settings.advanced_config': '高级配置',
            'settings.show_advanced': '显示高级选项',
            
            // Common
            'common.save': '保存',
            'common.cancel': '取消',
            'common.delete': '删除',
            'common.edit': '编辑',
            'common.view': '查看',
            'common.close': '关闭',
            'common.loading': '加载中...',
            'common.error': '错误',
            'common.success': '成功',
            'common.warning': '警告',
            'common.info': '信息',
            'common.confirm': '确认',
            'common.yes': '是',
            'common.no': '否',
            'common.actions': '操作',
            
            // Messages
            'message.connection_lost': '连接中断。正在尝试重新连接...',
            'message.connection_restored': '连接已恢复',
            'message.new_message': '收到新消息',
            'message.send_success': '消息发送成功',
            'message.send_error': '消息发送失败',
            
            // Time
            'time.now': '刚刚',
            'time.minute_ago': '1分钟前',
            'time.minutes_ago': '{0}分钟前',
            'time.hour_ago': '1小时前',
            'time.hours_ago': '{0}小时前',
            'time.day_ago': '1天前',
            'time.days_ago': '{0}天前',
            'time.week_ago': '1周前',
            'time.weeks_ago': '{0}周前',
            'time.month_ago': '1个月前',
            'time.months_ago': '{0}个月前',
            'time.year_ago': '1年前',
            'time.years_ago': '{0}年前',
            
            // Buttons
            'button.refresh': '刷新',
            'button.upload': '上传',
            'button.download': '下载',
            'button.clear': '清除',
            'button.search': '搜索',
            'button.filter': '筛选',
            'button.sort': '排序',
            'button.export': '导出',
            'button.import': '导入',
            'button.connect': '连接',
            'button.disconnect': '断开',
            'button.send': '发送',
            'button.receive': '接收',
            'button.admin_login': '管理员登入',
            'button.logout_admin': '登出管理员',
            'admin.modal_title': '管理员登入',
            'admin.password_label': '管理员密码',
            'admin.login_button': '登入',
            
            // Toast Notifications (Simplified Chinese)
            'toast.settings_saved': '设定保存成功！',
            'toast.profile_saved': '配置文件保存成功',
            'toast.profile_loaded': '配置文件加载成功',
            'toast.profile_deleted': '配置文件删除成功',
            'toast.cannot_delete_default': '无法删除默认配置文件',
            'toast.enter_profile_name': '请输入配置文件名称',
            'toast.select_profile_delete': '请选择要删除的配置文件',
            'toast.server_restarting': '服务器正在重新启动。请稍候并刷新页面。',
            'toast.chat_deleted': '聊天记录删除成功',
            'toast.chat_history_cleared': '所有聊天记录已清除',
            'toast.chat_exported': '聊天记录导出成功',
            'toast.triggers_saved': '触发器保存成功',
            'toast.trigger_exists': '此触发器已存在！',
            'toast.trigger_empty': '触发器文本不能为空',
            'toast.trigger_updated': '触发器已更新',
            'toast.refreshing_triggers': '正在刷新触发器...',
            'toast.failed_load_triggers': '加载触发器失败',
            'toast.failed_save_triggers': '保存触发器失败',
            'toast.no_chat_open': '错误：当前没有打开的聊天',
            'toast.chat_refreshed': '聊天记录刷新成功',
            'toast.ai_enabled': '聊天 AI 已启用',
            'toast.ai_disabled': '聊天 AI 已停用',
            'toast.message_sent': '消息发送成功',
            'toast.error_prefix': '错误：',
            'toast.failed_prefix': '失败：',
            
            // Commands
            'commands.title': '命令历史',
            'commands.recent': '最近命令',
            'commands.time': '时间',
            'commands.sender': '发送者',
            'commands.command': '命令',
            'commands.arguments': '参数',
            
            // Triggers
            'triggers.title': '机器人触发器',
            'triggers.description': '配置在群组聊天中触发机器人回应的字词或短语。',
            'triggers.group_chat': '群组聊天触发器',
            'triggers.group_help': '这些字词在消息中任何地方被提及时将激活群组聊天中的机器人。',
            'triggers.add_trigger': '添加新触发器字词...',
            'triggers.case_insensitive_help': '触发器不区分大小写。如果消息中出现任何这些字词，机器人将会回应。',
            'triggers.custom': '自定义触发器',
            'triggers.custom_help': '为特定用途添加自定义触发器。',
            'triggers.add_custom': '添加新自定义触发器...',
            'triggers.save': '保存触发器',
            
            // System
            'system.title': '系统信息',
            'system.restart_server': '重启服务器',
            'system.environment': '环境',
            'system.nodejs_version': 'Node.js 版本',
            'system.platform': '平台',
            'system.cpu': '处理器',
            'system.uptime': '运行时间',
            'system.show_branding': '显示品牌',
            'system.show_whatsxeno_logo': '显示 WhatsXENO 标志与图标',
            'system.memory_usage': '内存使用',
            'system.rss': '常驻内存',
            'system.heap_total': '堆总量',
            'system.heap_used': '已使用堆',
            'system.external': '外部内存',
            'system.gpu_info': 'GPU 信息',
            'system.loading_gpu': '加载 GPU 信息中...',
            'system.model': '型号',
            'system.vendor': '供应商',
            'system.vram': '显存',
            'system.driver': '驱动程序',
            'system.unknown': '未知',
            
            // Platforms (Simplified Chinese)
            'platforms.title': '平台管理',
            'platforms.refresh': '刷新状态',
            'platforms.whatsapp': 'WhatsApp',
            'platforms.telegram': 'Telegram',
            'platforms.facebook': 'Facebook Messenger',
            'platforms.instagram': 'Instagram',
            'platforms.connection_method': '连接方式',
            'platforms.whatsapp_method': 'WhatsApp Web（二维码）',
            'platforms.telegram_method': '机器人 API 令牌',
            'platforms.facebook_official': '官方 API（推荐）',
            'platforms.facebook_easy': '简易设置（登录）',
            'platforms.instagram_official': '官方 API（商业账号）',
            'platforms.instagram_private': '私人 API（非官方）',
            'platforms.instagram_web': '网页自动化',
            'platforms.bot_token': '机器人令牌',
            'platforms.page_access_token': '页面访问令牌',
            'platforms.verify_token': '验证令牌',
            'platforms.app_secret': '应用程序密钥',
            'platforms.access_token': '访问令牌',
            'platforms.email': '电子邮件',
            'platforms.password': '密码',
            'platforms.username': '用户名',
            'platforms.auth_method': '认证方式',
            'platforms.login_credentials': '登录凭证',
            'platforms.session_id': '会话 ID（推荐）',
            'platforms.session_help': '从浏览器登录 Instagram 后提取 sessionid Cookie',
            'platforms.instagram_private_info': '会话 ID 方法更稳定，避免登录挑战。',
            'platforms.connect': '连接',
            'platforms.disconnect': '断开连接',
            'platforms.facebook_warning': '使用专用机器人账号。避免双重验证。',
            'platforms.instagram_warning': '使用专用机器人账号。有限制风险。',
            'platforms.instagram_web_info': '浏览器自动化备用方法。',
            'platforms.status': '状态',
            'platforms.status.unknown': '未知',
            'platforms.status.not_connected': '未连接',
            'platforms.status.connected': '已连接',
            'platforms.status.disconnected': '已断开',
            'platforms.status.connecting': '连接中',
            'platforms.status.error': '错误',
            'platforms.status_summary': '平台状态摘要',
            'platforms.platform': '平台',
            'platforms.method': '方式',
            'platforms.last_activity': '最后活动',
            'platforms.actions': '操作',
            'platforms.never': '从未',
            'platforms.connecting_status': '连接中...',
            'platforms.connected_success': '连接成功',
            'platforms.connection_failed': '连接失败',
            'platforms.disconnected_success': '断开连接成功',
            'platforms.disconnect_failed': '断开连接失败',
            'platforms.invalid_credentials': '无效凭证',
            'platforms.configuration_saved': '配置已保存',
            'platforms.configuration_failed': '保存配置失败',
            
            // Workflows (Simplified Chinese)
            'workflow.title': '工作流程管理',
            'workflow.upload': '上传工作流程',
            'workflow.open_editor': '打开工作流程编辑器',
            'workflow.available': '可用工作流程',
            'workflow.refresh': '刷新',
            'workflow.name': '名称',
            'workflow.description': '描述',
            'workflow.status': '状态',
            'workflow.actions': '操作',
            'workflow.no_description': '无描述',
            'workflow.enabled': '已启用',
            'workflow.disabled': '已停用',
            'workflow.enable': '启用',
            'workflow.disable': '停用',
            'workflow.view': '查看',
            'workflow.no_workflows': '无可用工作流程。请在 Node-RED 编辑器中创建工作流程。',
            'workflow.load_failed': '加载工作流程失败',
            'workflow.load_error': '加载工作流程失败：',
            
            // Buttons (Simplified Chinese)
            'button.close': '关闭',
            'button.refresh_qr': '刷新 QR 码',
            'button.upload_document': '上传文档',
            'button.loading_documents': '加载文档中...',
            
            // QR Code Modal (Simplified Chinese)
            'qr.modal_title': '扫描 WhatsApp QR 码',
            'qr.loading': '加载 QR 码中...',
            'qr.generating': '生成 QR 码中...',
            'qr.scan_instruction': '使用您的 WhatsApp 手机应用程序扫描 QR 码',
            
            // Common (additional)
            'common.add': '添加',
            'common.delete_chat': '删除聊天',
            'common.delete_chat_confirm': '您确定要删除这个聊天记录吗？此操作无法撤销。',
            'common.notification': '通知'
        };
    }

    // Detect browser language
    detectLanguage() {
        const saved = localStorage.getItem('whatsxeno_language');
        if (saved && this.translations[saved]) {
            this.currentLanguage = saved;
            return;
        }

        const browserLang = navigator.language || navigator.userLanguage;
        
        // Check for exact match first
        if (this.translations[browserLang]) {
            this.currentLanguage = browserLang;
            return;
        }

        // Check for language family match
        const langFamily = browserLang.split('-')[0];
        const availableLanguages = Object.keys(this.translations);
        
        for (const lang of availableLanguages) {
            if (lang.startsWith(langFamily)) {
                this.currentLanguage = lang;
                return;
            }
        }

        // Default to English
        this.currentLanguage = this.fallbackLanguage;
    }

    // Get translation
    t(key, ...args) {
        const translation = this.translations[this.currentLanguage]?.[key] || 
                          this.translations[this.fallbackLanguage]?.[key] || 
                          key;
        
        // Handle string interpolation
        if (args.length > 0) {
            return translation.replace(/\{(\d+)\}/g, (match, index) => {
                return args[index] !== undefined ? args[index] : match;
            });
        }
        
        return translation;
    }

    // Set language
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('whatsxeno_language', lang);
            this.updateUI();
            return true;
        }
        return false;
    }

    // Get current language
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Get available languages
    getAvailableLanguages() {
        return {
            'en': 'English',
            'zh-TW': '繁體中文',
            'zh-CN': '简体中文'
        };
    }

    // Update UI with current language
    updateUI() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        // Update elements with data-i18n-title attribute
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // Update document title
        const titleElement = document.querySelector('[data-i18n-title-page]');
        if (titleElement) {
            const key = titleElement.getAttribute('data-i18n-title-page');
            document.title = this.t(key);
        }

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLanguage;

        // Trigger custom event for other components to update
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: this.currentLanguage }
        }));
    }

    // Format relative time
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return this.t('time.now');
        if (minutes === 1) return this.t('time.minute_ago');
        if (minutes < 60) return this.t('time.minutes_ago', minutes);
        if (hours === 1) return this.t('time.hour_ago');
        if (hours < 24) return this.t('time.hours_ago', hours);
        if (days === 1) return this.t('time.day_ago');
        if (days < 7) return this.t('time.days_ago', days);
        if (weeks === 1) return this.t('time.week_ago');
        if (weeks < 4) return this.t('time.weeks_ago', weeks);
        if (months === 1) return this.t('time.month_ago');
        if (months < 12) return this.t('time.months_ago', months);
        if (years === 1) return this.t('time.year_ago');
        return this.t('time.years_ago', years);
    }
}

// Create global instance
window.i18n = new I18n();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.updateUI();
});
