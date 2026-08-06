import os
import glob

def fix_file(file_path):
    try:
        with open(file_path, 'rb') as f:
            raw_data = f.read()

        if len(raw_data) == 0:
            return

        # 既に UTF-8 かつ <meta charset="UTF-8"> が入っている場合は即スキップ（無駄を排除）
        if b'<meta charset="UTF-8">' in raw_data or b'<meta charset=\\"UTF-8\\">' in raw_data:
            print(f"[SKIP (済)] 変換済みのためスキップ: {os.path.basename(file_path)}")
            return

        # Shift-JIS (CP932) のみ変換処理を実行
        text = None
        try:
            text = raw_data.decode('cp932')
        except Exception:
            # 既にUTF-8だがmetaタグが無い場合などのフォールバック
            try:
                text = raw_data.decode('utf-8')
            except Exception:
                print(f"[ERROR] 文字コード判定失敗: {file_path}")
                return

        # <meta charset="UTF-8"> を挿入
        meta_tag = '<meta charset="UTF-8">'
        if meta_tag not in text and '<head>' in text:
            text = text.replace('<head>', '<head>\n' + meta_tag)

        # UTF-8 で上書き保存
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)

        print(f"[SUCCESS (変換)] UTF-8変換完了: {file_path}")

    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    report_dir = os.path.join(base_dir, "report")

    print("==================================================")
    print(" MT4 レポート未変換ファイルのみ高速一括チェック & 変換")
    print("==================================================")

    htm_files = glob.glob(os.path.join(report_dir, "**", "*.htm"), recursive=True)

    if not htm_files:
        print("対象ファイルがありません。")
        return

    for htm_file in htm_files:
        fix_file(htm_file)

    print("\nチェック完了！")

if __name__ == "__main__":
    main()
