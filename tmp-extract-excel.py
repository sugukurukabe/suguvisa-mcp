import pandas as pd
import json

def extract_v():
    files = {
        'CERT': '一括登録用Excelツール_認定 シート.xlsm',
        'RENEWAL': '一括登録用Excelツール_更新 シート.xlsm',
        'CHANGE': '一括登録用Excelツール_変更 シート.xlsm'
    }
    
    headers = {}
    for key, filename in files.items():
        try:
            xl = pd.ExcelFile(filename)
            # Find the sheet for V
            sheet_name = None
            for s in xl.sheet_names:
                if '区分V' in s:
                    sheet_name = s
                    break
            if not sheet_name:
                print(f"No V sheet in {filename}")
                continue
                
            df = xl.parse(sheet_name, nrows=5, header=None)
            
            # The 4th row (index 3) seems to be the one with headers
            row_3 = df.values.tolist()[3]
            # filter out blanks
            cols = [str(x) for x in row_3 if pd.notna(x) and str(x).strip() != ""]
            headers[key] = cols
        except Exception as e:
            print(f"Error reading {filename}: {e}")

    with open('tmp-headers.json', 'w', encoding='utf-8') as f:
        json.dump(headers, f, ensure_ascii=False, indent=2)
        print("Wrote headers to tmp-headers.json")

if __name__ == "__main__":
    extract_v()
