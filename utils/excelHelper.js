const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const ensureDirExists = (filePath) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const readExcel = (filePath, options = {}) => {
    try {
        ensureDirExists(filePath);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const workbook = xlsx.readFile(filePath);
        const sheetName = options.sheet || workbook.SheetNames[0];
        return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
            raw: false,
            dateNF: 'yyyy-mm-dd',
            defval: '',
            ...options
        });
    } catch (error) {
        console.error(`Error reading Excel file ${filePath}:`, error);
        throw error;
    }
};

const writeExcel = (filePath, data, sheetName = 'Sheet1', options = {}) => {
    try {
        ensureDirExists(filePath);
        let workbook;
        
        // Try to read existing file or create new workbook
        if (fs.existsSync(filePath)) {
            workbook = xlsx.readFile(filePath);
        } else {
            workbook = xlsx.utils.book_new();
        }
        
        // Convert data to worksheet
        const ws = xlsx.utils.json_to_sheet(data, {
            header: options.headers || Object.keys(data[0] || {}),
            skipHeader: false
        });
        
        // Add or update sheet
        if (workbook.SheetNames.includes(sheetName)) {
            workbook.Sheets[sheetName] = ws;
        } else {
            xlsx.utils.book_append_sheet(workbook, ws, sheetName);
        }
        
        // Write to file
        xlsx.writeFile(workbook, filePath);
        return true;
    } catch (error) {
        console.error(`Error writing to Excel file ${filePath}:`, error);
        throw error;
    }
};

const backupFile = (filePath, backupDir) => {
    try {
        if (!fs.existsSync(filePath)) return null;
        
        ensureDirExists(backupDir);
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${baseName}_${timestamp}${ext}`);
        
        fs.copyFileSync(filePath, backupPath);
        return backupPath;
    } catch (error) {
        console.error(`Error creating backup for ${filePath}:`, error);
        throw error;
    }
};

module.exports = {
    readExcel,
    writeExcel,
    backupFile
};
