"""Read-only legacy Excel/CSV inspector. Produces a review file, never edits source.
Usage: python legacy_import.py source.xlsx --output reviewed.json
CSV: python legacy_import.py 3H.csv --class-sheet 3H --output reviewed.json
Install openpyxl for XLSX: python -m pip install openpyxl
"""
import argparse, csv, hashlib, json, re
from pathlib import Path

SUBJECTS=['BM','BI','MM','SN','PI','PM','BA','BT','BC','PJPK','MZ','PSV','SEJ','RBT']
def grade(score):
    return next(g for minimum,g in [(82,'A'),(66,'B'),(50,'C'),(35,'D'),(20,'E'),(0,'F')] if score>=minimum)
def inspect(path, class_sheet=None, year='2026'):
    raw=Path(path).read_bytes(); sheets=[]
    if Path(path).suffix.lower()=='.csv':
        if not class_sheet or not re.fullmatch(r'[1-6][HJ]',class_sheet): raise ValueError('CSV requires --class-sheet, e.g. 3H')
        rows=list(csv.reader(raw.decode('utf-8-sig').splitlines()))
        sheets=[(class_sheet,rows)]
    else:
        import openpyxl
        wb=openpyxl.load_workbook(path,read_only=True,data_only=True)
        sheets=[(s.title,list(s.values)) for s in wb if re.fullmatch(r'[1-6][HJ]',s.title)]
    students=[]; discrepancies=[]; issues=[]; names={}; source_headers={}
    for name,rows in sheets:
        if not rows: raise ValueError('Empty class sheet: '+name)
        header=rows[0]; source_headers[name]=list(header); level=int(name[0]); offered=SUBJECTS if level>=4 else SUBJECTS[:12]
        if str(header[0]).strip()!='BIL': issues.append({'sheet':name,'cell':'A1','issue':'Malformed BIL header','original':header[0]})
        for number,row in enumerate(rows[1:],2):
            if len(row)<3 or row[1] in (None,''): continue
            if row[0]!=number-1 and str(row[0])!=str(number-1): issues.append({'sheet':name,'cell':f'A{number}','issue':'Non-sequential display BIL; never used as identity','original':row[0]})
            student={'name':str(row[1]).strip(),'source_sheet':name,'source_row':number,'year_level':level,'class_name':str(row[2]).strip(),'marks':{}}
            key=student['name'].upper();names[key]=names.get(key,0)+1
            for i,code in enumerate(offered):
                column=3+i*2; cell=f'{chr(65+column) if column<26 else "A"+chr(65+column-26)}{number}'
                value=row[column] if len(row)>column else None; original=value
                cached=row[column+1] if len(row)>column+1 else None
                if isinstance(value,str): value=value.strip().upper();value=None if value=='' else value
                if isinstance(value,str) and value not in ['TB','TH']:
                    if re.fullmatch(r'\d{1,3}(\.0)?',value): value=int(float(value))
                    else: issues.append({'sheet':name,'cell':cell,'issue':'Invalid mark','original':original})
                expected=grade(value) if isinstance(value,(int,float)) and 0<=value<=100 else None
                if isinstance(value,(int,float)) and (value<0 or value>100 or value!=int(value)): issues.append({'sheet':name,'cell':cell,'issue':'Invalid whole-number score','original':original})
                if expected and expected!=cached: discrepancies.append({'sheet':name,'cell':cell,'score':value,'original_grade':cached,'recalculated_grade':expected})
                student['marks'][code]={'cell':cell,'value':value,'original_value':original,'grade':cached}
            students.append(student)
    issues.extend({'issue':'Duplicate name requires identity review','name':n,'count':count} for n,count in names.items() if count>1)
    return {'kind':'MPS_LEGACY_REVIEW','year':str(year),'source_headers':source_headers,'source_sha256':hashlib.sha256(raw).hexdigest(),'students':students,'discrepancies':discrepancies,'issues':issues,'summary':{'students':len(students),'numeric':sum(isinstance(m['value'],(int,float)) for s in students for m in s['marks'].values()),'TH':sum(m['value']=='TH' for s in students for m in s['marks'].values()),'blank':sum(m['value'] is None for s in students for m in s['marks'].values())}}
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('source');a.add_argument('--output',required=True);a.add_argument('--class-sheet');a.add_argument('--year',default='2026');args=a.parse_args()
    result=inspect(args.source,args.class_sheet,args.year);Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result['summary']));print(f"Discrepancies: {len(result['discrepancies'])}; issues: {len(result['issues'])}. Source untouched.")
