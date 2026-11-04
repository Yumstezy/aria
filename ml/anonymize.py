"""Take the rated mixes' names out of the public data (Nov 3, Ian: some of the producers asked to stay private).

  python3 ml/anonymize.py        # run after any script that rewrites ml/data/*.csv from the audio

Only mixes credited to 4times4 or Brill (their own songs and collabs) keep their names. Every other mix becomes
<TIER>_mix-<mix_id>, and every song key becomes song-NNN in its original sorted order, the same in every file, so
the song and producer groups, and the test splits made from them, stay exactly the same. The real names go to ml/data/private/name-map.csv, which is
gitignored. Running it twice changes nothing.
"""
import csv
import hashlib
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
PRIVATE = DATA / "private" / "name-map.csv"
OURS = re.compile(r"(?<![a-z0-9])(4times4|brill)(?![a-z0-9])", re.I)
PLAIN = {"BPM in the artist part", 'no " - " in the name', "title and artist are swapped in the name", "collab", "4times4 remix", "4times4 flip",
         "the same producer under another name"}
ANON = re.compile(r"^(?:good/|mid/|bad/)?(GOOD|MID|BAD)_mix-[0-9a-f]+\.\w+$")


def kept(path):
    """A mix credited to 4times4 or Brill: the artist part (before " - ") names them, or the name is "Title - Brill"
    (title and artist swapped, ml/data/song_groups.csv). A name with no artist part (a master Brill only mastered) isn't."""
    base = path.rpartition("/")[2]
    parts = base.split("_", 1)[-1].split(" - ")
    return len(parts) > 1 and bool(OURS.search(parts[0]) or OURS.match(parts[1].strip()))


def short(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]


def read(name):
    with open(DATA / name, encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        return r.fieldnames, list(r)


def write(name, fields, rows):
    with open(DATA / name, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def main():
    _, manifest = read("manifest.csv")
    ids = {r["file"]: r["mix_id"] for r in manifest}
    files = {}   # original base name -> public base name

    def public_file(path):
        sub, _, base = path.rpartition("/")
        if ANON.match(base) or kept(base):
            return path
        tier = base.split("_", 1)[0]
        new = f"{tier}_mix-{ids.get(base) or short(base)}{Path(base).suffix}"
        files[base] = new
        return f"{sub}/{new}" if sub else new

    # Song keys become song-NNN, numbered in the keys' own sorted order: the grouped test splits order the groups by
    # key (np.unique), so any other renaming reshuffles the 50 rounds and moves the published numbers (checked Nov 3:
    # hash names gave 0.73 instead of 0.75). All keys are renamed, Brill's and 4times4's too; their file names stay.
    keys = set()
    for name in ("curves.csv", "features.csv", "song_groups.csv"):
        _, rows = read(name)
        keys |= {r["song"] for r in rows}
    songs = {} if all(re.fullmatch(r"song-\d{3}", k) for k in keys) else {k: f"song-{i:03d}" for i, k in enumerate(sorted(keys))}

    def public_song(s):
        return songs.get(s, s)

    for name in ("manifest.csv", "features.csv", "curves.csv", "curves_multi.csv", "aesthetics.csv", "excluded.csv", "song_groups.csv"):
        fields, rows = read(name)
        for r in rows:
            r["file"] = public_file(r["file"])
            if "song" in r:
                r["song"] = public_song(r["song"])
        write(name, fields, rows)
    # Free-text reasons can name a mix or its producer too: on an anonymized row, only a reason that names nobody stays
    for name in ("excluded.csv", "song_groups.csv"):
        fields, rows = read(name)
        for r in rows:
            for old, new in files.items():
                r["why"] = r["why"].replace(old, new)
            if not kept(r["file"]) and r["why"] not in PLAIN and not r["why"].startswith(("byte-for-byte", "m4a/AAC")):
                r["why"] = "the same producer under another name"
        write(name, fields, rows)

    if files or songs:
        PRIVATE.parent.mkdir(exist_ok=True)
        old = PRIVATE.read_text(encoding="utf-8").splitlines()[1:] if PRIVATE.exists() else []
        lines = sorted(set(old) | {f'file,"{a}","{b}"' for a, b in files.items()} | {f'song,"{a}","{b}"' for a, b in songs.items()})
        PRIVATE.write_text("kind,real,public\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"anonymized {len(files)} file names and {len(songs)} song keys; names kept for 4times4 and Brill")


if __name__ == "__main__":
    main()
