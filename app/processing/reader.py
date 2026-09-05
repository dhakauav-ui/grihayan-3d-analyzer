import io
import csv
from pathlib import Path
from typing import Tuple, List, Dict, Any
import pandas as pd
from app.core.errors import InvalidFileFormatException, EmptyFileException

def detect_csv_delimiter_and_header(sample_bytes: bytes) -> Tuple[str, bool]:
    """
    Detects CSV delimiter and determines if the file has a textual header.
    """
    sample_text = ""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            sample_text = sample_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    
    if not sample_text:
        sample_text = sample_bytes.decode("utf-8", errors="ignore")
    
    lines = [line.strip() for line in sample_text.splitlines() if line.strip()][:30]
    if not lines:
        return ",", False

    # Check common delimiters
    sample_block = "\n".join(lines[:10])
    try:
        dialect = csv.Sniffer().sniff(sample_block, delimiters=",;\t| ")
        delimiter = dialect.delimiter
    except Exception:
        # Fallback count
        counts = {
            ",": sample_block.count(","),
            "\t": sample_block.count("\t"),
            ";": sample_block.count(";"),
            "|": sample_block.count("|")
        }
        delimiter = max(counts, key=counts.get) if max(counts.values()) > 0 else ","

    # Determine if first line is a header
    first_line = lines[0]
    tokens = [t.strip() for t in first_line.split(delimiter) if t.strip()]
    
    # Check if first line tokens are numeric
    def is_number(val: str) -> bool:
        try:
            float(val)
            return True
        except ValueError:
            return False

    numeric_count = sum(1 for t in tokens if is_number(t))
    # If the majority of tokens in line 1 are numeric, it is NOT a header
    has_header = False
    if len(tokens) > 0 and (numeric_count / len(tokens)) < 0.5:
        # Check if line 2 is different (mostly numbers)
        if len(lines) > 1:
            line2_tokens = [t.strip() for t in lines[1].split(delimiter) if t.strip()]
            line2_num_count = sum(1 for t in line2_tokens if is_number(t))
            if line2_num_count > numeric_count:
                has_header = True
        else:
            has_header = True

    return delimiter, has_header


def read_survey_file(file_path: Path) -> Tuple[pd.DataFrame, bool, List[str]]:
    """
    Reads a survey file (CSV, XLSX, XLS, TXT) into a pandas DataFrame.
    Returns: (DataFrame, has_headers_bool, headers_list)
    """
    if not file_path.exists():
        raise InvalidFileFormatException(f"File not found: {file_path.name}")
    
    ext = file_path.suffix.lower()
    if ext not in {".csv", ".xlsx", ".xls", ".txt"}:
        raise InvalidFileFormatException(f"Unsupported file extension: {ext}")

    try:
        if ext in {".xlsx", ".xls"}:
            # Read first few rows to check header
            sample_df = pd.read_excel(file_path, nrows=5, header=None)
            if sample_df.empty:
                raise EmptyFileException()
            
            # Check if row 0 has strings and row 1 has numbers
            row0_is_str = any(isinstance(val, str) and not val.replace('.', '', 1).isdigit() for val in sample_df.iloc[0])
            has_header = row0_is_str

            if has_header:
                df = pd.read_excel(file_path, header=0)
                headers = [str(c).strip() for c in df.columns]
                # clean column names
                df.columns = headers
            else:
                df = pd.read_excel(file_path, header=None)
                headers = [f"Col_{i+1}" for i in range(df.shape[1])]
                df.columns = headers

        else: # CSV or TXT
            with open(file_path, "rb") as f:
                sample_bytes = f.read(16384)
            
            delimiter, has_header = detect_csv_delimiter_and_header(sample_bytes)

            for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
                try:
                    if has_header:
                        df = pd.read_csv(
                            file_path,
                            sep=delimiter,
                            encoding=enc,
                            header=0,
                            dtype=str,
                            skip_blank_lines=True,
                            on_bad_lines="skip"
                        )
                        headers = [str(c).strip() for c in df.columns]
                        df.columns = headers
                    else:
                        df = pd.read_csv(
                            file_path,
                            sep=delimiter,
                            encoding=enc,
                            header=None,
                            dtype=str,
                            skip_blank_lines=True,
                            on_bad_lines="skip"
                        )
                        headers = [f"Col_{i+1}" for i in range(df.shape[1])]
                        df.columns = headers
                    break
                except (UnicodeDecodeError, Exception) as e:
                    if enc == "latin-1":
                        raise InvalidFileFormatException(f"Failed to parse text file: {str(e)}")
                    continue

        if df.empty:
            raise EmptyFileException()

        return df, has_header, headers

    except EmptyFileException:
        raise
    except Exception as e:
        raise InvalidFileFormatException(f"Error reading survey file '{file_path.name}': {str(e)}")
