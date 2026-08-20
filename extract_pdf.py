import pypdf

reader = pypdf.PdfReader(r"C:\Users\batab\.gemini\antigravity\MyProjects\darkvenus-lab\columnsource\アクセス数増加施策検討.pdf")
with open(r"C:\Users\batab\.gemini\antigravity\MyProjects\darkvenus-lab\extracted_text.txt", "w", encoding="utf-8") as f:
    for page in reader.pages:
        f.write(page.extract_text() + "\n")
