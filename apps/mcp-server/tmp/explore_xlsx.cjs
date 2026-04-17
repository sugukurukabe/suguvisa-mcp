// @ts-nocheck
const XlsxPopulate = require('xlsx-populate');

async function main() {
    const filename = "一括登録用Excelツール_変更 シート.xlsm";
    console.log(`Loading ${filename} ...`);
    
    console.time("load");
    const workbook = await XlsxPopulate.fromFileAsync(filename);
    console.timeEnd("load");

    console.log("Sheets:");
    workbook.sheets().forEach(sheet => {
        console.log(` - ${sheet.name()}`);
    });

    const sheet = workbook.sheet("申請情報入力");
    if (sheet) {
        console.log("\nSheet '申請情報入力' first 10 rows:");
        for(let i=1; i<=10; i++) {
            // Read 10 columns for each row
            const rowVals = [];
            for(let j=1; j<=10; j++) {
                rowVals.push(sheet.cell(i, j).value());
            }
            console.log(`Row ${i}:`, rowVals);
        }
        
        // Try modifying and saving
        sheet.cell("A1").value("TEST");
        console.time("save");
        await workbook.toFileAsync("output_test.xlsm");
        console.timeEnd("save");
        console.log("Saved to output_test.xlsm successfully");
    } else {
        console.log("Sheet not found");
    }
}

main().catch(console.error);
