"""Ian's own racks (Nov 1), renamed for Aria: "Aria <what it does>", so the producer knows it's Aria's tool.

  python3 device/tools/make_aria_racks.py "<folder with Ian's .adg/.adv racks>"

Writes device/racks/Aria <name>.adg (or .adv) with the top device renamed inside the file too, so Live shows the
Aria name when the rack loads. install.sh copies them into the User Library, where Aria's helper loads them.
"""
import gzip
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

NAMES = {   # Ian's file, without its maker prefix -> Aria's name (engine/aria_engine/racks.py says what each does)
    "KICK GLUE COMP.adv": "Aria Kick Glue",
    "KICK MIXING.adg": "Aria Kick Mix",
    "KICK ENCHANCEMENT.adg": "Aria Kick Enhance",
    "HARD ASF KICKERRRR.adg": "Aria Hard Kick",
    "PUNCH THROUGH.adg": "Aria Punch Through",
    "BASS CLEAN THICC SATURATOR.adg": "Aria Bass Thicken",
    "RBASS REMAKE.adg": "Aria Wide Bass",
    "3 BAND SPLITTTER.adg": "Aria 3 Band Split",
    "QUICK MASTER CHAIN.adg": "Aria Master Chain",
    "EZY CLIPPER.adg": "Aria Clipper",
    "STARTER REVERB.adg": "Aria Reverb",
    "REVERB V2.adv": "Aria Plain Reverb",
    "EASY DELAY STARTER.adg": "Aria Delay",
    "DELAY GROOVE.adg": "Aria Groove Delay",
    "BASIC FX .adg": "Aria Filter FX",
    "Synth FX.adg": "Aria Synth FX",
    "SNARE FUZZ.adg": "Aria Snare Fuzz",
    "VINYL FX.adg": "Aria Vinyl",
    "TRANSITION WASH.adg": "Aria Transition Wash",
    "FAKE OUT PREMIUM.adg": "Aria Fake Out",
    "ENCHANTER.adg": "Aria Enchanter",
    "SCREAM CRISP FX.adg": "Aria Crisp",
    "BASS FX.adg": "Aria Bass FX",
    "BASS DOWN SAMPLE EFFECT.adg": "Aria Bass Downsample",
    "REVERSE FX  REVERB SEND.adg": "Aria Reverse Reverb",
    "ENDLESS SMILE RACK.adg": "Aria Endless Smile",
}


def top_device(root):
    """The preset's own device: a rack (.adg) has it under GroupDevicePreset > Device, a device preset (.adv) is it."""
    dev = root.find("GroupDevicePreset/Device")
    if dev is not None and len(dev):
        return dev[0]
    if len(root) and root[0].find("UserName") is not None:
        return root[0]
    raise ValueError("no device in the preset")


def main(src):
    out = Path(__file__).resolve().parents[1] / "racks"
    out.mkdir(exist_ok=True)
    # Matched without the maker's prefix ("BRILL ", "DØWD - "), which Ian changes; macOS keeps names decomposed
    bare = lambda t: re.sub(r"^\S+\s+(-\s+)?", "", unicodedata.normalize("NFC", t))
    files = {bare(f.name): f for f in Path(src).iterdir() if f.suffix in (".adg", ".adv")}
    for name, aria in NAMES.items():
        raw = gzip.decompress(files[name].read_bytes())
        tree = ET.ElementTree(ET.fromstring(raw))
        dev = top_device(tree.getroot())
        user = dev.find("UserName")
        user.set("Value", aria)
        dest = out / (aria + Path(name).suffix)
        dest.write_bytes(gzip.compress(b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(tree.getroot(), encoding="utf-8")))
        print(f"{name} -> {dest.name} ({dev.tag})")


if __name__ == "__main__":
    main(sys.argv[1])
