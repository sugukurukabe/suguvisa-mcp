import ExcelJS from 'exceljs';

async function main() {
    const filename = "一括登録用Excelツール_変更 シート.xlsm";
    console.log(`Loading ${filename} ...`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filename);

    console.log("Sheets in workbook:");
    workbook.eachSheet((sheet, id) => {
        console.log(` - ${id}: ${sheet.name}`);
    });

    const sheet = workbook.getWorksheet("申請情報入力"); // Usually the form sheet is this
    if (sheet) {
        console.log("\nSheet '申請情報入力' first 10 rows:");
        for(let i=1; i<=10; i++) {
            const row = sheet.getRow(i);
            const vals = row.values;
            if (vals && Array.isArray(vals) && vals.length > 0) {
                // exceljs values are 1-indexed, so vals[0] is typically null
                console.log(`Row ${i}:`, vals.slice(1, 10));
            }
        }
    } else {
        console.log("\nSheet '申請情報入力' not found.");
    }
}

main().catch(console.error);
