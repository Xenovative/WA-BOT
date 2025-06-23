const excel = require('xlsx');
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
const backupDir = path.join(dataDir, 'backups');
[dataDir, backupDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Helper function to create workbook with localized styles
function createWorkbook() {
    const wb = excel.utils.book_new();
    
    // Add Hong Kong locale for date/number formatting
    wb.Props = {
        Title: "Payment System Templates",
        CreatedDate: new Date(),
        locale: "zh-HK"
    };
    
    return wb;
}

// 1. Customers Template
function createCustomersTemplate() {
    const data = [
        [
            "客戶編號",    // Customer ID
            "姓名",        // Name (Chinese)
            "英文姓名",    // Name (English)
            "電話",        // Phone
            "電郵",        // Email
            "地址",        // Address
            "狀態",        // Status (Active/Inactive)
            "備註",        // Notes
            "創建日期",    // Created Date
            "更新日期"     // Updated Date
        ],
        [
            "CUST001",
            "陳大文",
            "Chan Tai Man",
            "+852 9123 4567",
            "tai.man@example.com",
            "香港中環德輔道中88號",
            "活躍",
            "VIP客戶",
            new Date(),
            new Date()
        ]
    ];
    
    const ws = excel.utils.aoa_to_sheet(data);
    
    // Add column widths
    ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 20 },
        { wch: 15 }, { wch: 25 }, { wch: 30 },
        { wch: 10 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }
    ];
    
    // Add freeze panes
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomRight' };
    
    return ws;
}

// 2. Payments Template
function createPaymentsTemplate() {
    const data = [
        [
            "付款編號",    // Payment ID
            "客戶編號",    // Customer ID
            "金額 (HKD)", // Amount in HKD
            "到期日",      // Due Date
            "狀態",        // Status (Pending/Paid/Overdue)
            "付款方式",    // Payment Method
            "參考編號",    // Reference Number
            "描述",        // Description
            "最後通知",    // Last Notified
            "創建日期",    // Created Date
            "更新日期"     // Updated Date
        ],
        [
            "PAY" + new Date().getFullYear() + "001",
            "CUST001",
            5000.00,
            new Date(new Date().setMonth(new Date().getMonth() + 1)),
            "待處理",
            "銀行轉帳",
            "INV2023001",
            "2023年10月租金",
            "",
            new Date(),
            new Date()
        ]
    ];
    
    const ws = excel.utils.aoa_to_sheet(data);
    
    // Add column widths
    ws['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 15 },
        { wch: 15 }, { wch: 20 }, { wch: 18 },
        { wch: 15 }, { wch: 15 }
    ];
    
    // Add number formatting for currency
    const range = excel.utils.decode_range(ws['!ref']);
    for (let C = 2; C <= range.e.c; ++C) {
        const address = excel.utils.encode_cell({c: C, r: 1});
        if (ws[address]) {
            ws[address].z = '#,##0.00_);[Red]\(#,##0.00\)';
        }
    }
    
    // Add date formatting
    const dateCols = [3, 9, 10]; // Indices of date columns (0-based)
    dateCols.forEach(col => {
        const address = excel.utils.encode_cell({c: col, r: 1});
        if (ws[address]) {
            ws[address].z = 'yyyy-mm-dd';
        }
    });
    
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomRight' };
    
    return ws;
}

// 3. Payment Logs Template
function createPaymentLogsTemplate() {
    const data = [
        [
            "記錄ID",      // Log ID
            "時間戳",      // Timestamp
            "客戶編號",    // Customer ID
            "付款編號",    // Payment ID
            "操作",        // Action
            "狀態",        // Status
            "金額 (HKD)", // Amount
            "詳情",        // Details
            "IP地址",      // IP Address
            "用戶代理"     // User Agent
        ],
        [
            "LOG" + Date.now(),
            new Date(),
            "CUST001",
            "PAY" + new Date().getFullYear() + "001",
            "付款通知已發送",
            "成功",
            5000.00,
            "通過WhatsApp發送付款提醒",
            "192.168.1.1",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        ]
    ];
    
    const ws = excel.utils.aoa_to_sheet(data);
    
    // Add column widths
    ws['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 12 },
        { wch: 15 }, { wch: 20 }, { wch: 12 },
        { wch: 12 }, { wch: 30 }, { wch: 15 },
        { wch: 40 }
    ];
    
    // Format timestamp column
    const timestampCol = 1; // Column B (0-based)
    const range = excel.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
        const address = excel.utils.encode_cell({c: timestampCol, r: R});
        if (ws[address]) {
            ws[address].z = 'yyyy-mm-dd hh:mm:ss';
        }
    }
    
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomRight' };
    
    return ws;
}

// Main function to generate all templates
function generateTemplates() {
    try {
        // 1. Customers
        const customersWB = createWorkbook();
        excel.utils.book_append_sheet(customersWB, createCustomersTemplate(), '客戶資料');
        excel.writeFile(customersWB, path.join(dataDir, 'customers.xlsx'));
        
        // 2. Payments
        const paymentsWB = createWorkbook();
        excel.utils.book_append_sheet(paymentsWB, createPaymentsTemplate(), '付款記錄');
        excel.writeFile(paymentsWB, path.join(dataDir, 'payments.xlsx'));
        
        // 3. Payment Logs
        const logsWB = createWorkbook();
        excel.utils.book_append_sheet(logsWB, createPaymentLogsTemplate(), '系統日誌');
        excel.writeFile(logsWB, path.join(dataDir, 'payment_logs.xlsx'));
        
        console.log('Templates generated successfully in the data directory.');
        console.log('1. customers.xlsx - For managing customer information');
        console.log('2. payments.xlsx - For tracking payment records');
        console.log('3. payment_logs.xlsx - For system audit logs');
        
    } catch (error) {
        console.error('Error generating templates:', error);
    }
}

// Run the generator
generateTemplates();
