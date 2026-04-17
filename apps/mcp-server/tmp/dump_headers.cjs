// @ts-nocheck
const XlsxPopulate = require('xlsx-populate');
const fs = require('fs');

async function main() {
    const filename = "一括登録用Excelツール_変更 シート.xlsm";
    const workbook = await XlsxPopulate.fromFileAsync(filename);
    
    // Find the right sheet
    const sheet = workbook.sheets().find(s => s.name().includes('申請情報入力(在留資格変更'));
    if (!sheet) {
        throw new Error("Target sheet not found");
    }

    const output = {};
    
    for(let i=1; i<=10; i++) {
        const rowVals = [];
        for(let j=1; j<=150; j++) {
            const val = sheet.cell(i, j).value();
            rowVals.push(val === undefined ? null : val);
        }
        output[`Row_${i}`] = rowVals;
    }

    fs.writeFileSync("xlsm_headers_dump.json", JSON.stringify(output, null, 2));
    console.log("Dumped to xlsm_headers_dump.json");
}

main().catch(console.error);
