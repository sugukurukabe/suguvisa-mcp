import openpyxl

file_name = "一括登録用Excelツール_認定 シート.xlsm"
print(f"Loading {file_name}...")
# keep_vba=True is essential for preserving the macros (.bin)
wb = openpyxl.load_workbook(file_name, keep_vba=True)

print("Sheet names:")
for sheet in wb.sheetnames:
    print(f" - {sheet}")

# Let's peek at the first 5 rows of the first sheet
sheet = wb.active
print(f"\nFirst sheet: {sheet.title}")
for row_idx, row in enumerate(sheet.iter_rows(min_row=1, max_row=5, values_only=True)):
    # only print columns that have values to keep output readable
    vals = [str(x) for x in row if x is not None]
    if vals:
        print(f" Row {row_idx+1}: {vals[:10]} ...")
