"""Download and verify the scientific source assets used by the atlas build.

Source downloads stay in the ignored cache. SHA256 checks pin audited content;
BodyParts3D uses resumable HTTP ranges and HRA uses a versioned source URL.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import hashlib
import os
import time
import urllib.request
import zipfile

BASE = 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/'
URL = BASE + 'isa_BP3D_4.0_obj_99.zip'
ROOT = Path(__file__).resolve().parent / 'bodyparts3d-source'
TOTAL = 142903898
SIZE = 12 * 1024 * 1024
ARCHIVE_SHA = '40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e'
RESOURCES = [
    ('isa_parts_list_e.txt', BASE + 'isa_parts_list_e.txt', 'ab7796deedd49205e77f3609a1cb8c53e2bbee14ecb5c9a6ca05227469780513'),
    ('isa_element_parts.txt', BASE + 'isa_element_parts.txt', 'a3de74423f943b0d724ae8f59b3a817f87c423a544f8db98113b1980817cbeaf'),
    ('atlas.json', 'https://raw.githubusercontent.com/ashemag/human-atlas/1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models/atlas.json', 'c359f4bcd2cba90b7411d66d5e9fc04dc81294d46cd5c1e8b212c824f2e5bbee'),
    ('3d-vh-m-lung-v1.4.glb', 'https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/assets/3d-vh-m-lung.glb', 'bba95516fa993ac45c3b1c53f32b58d97232ffd78ae56397e5a2589c6ce4903d'),
]


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def download_range(index):
    lo = index * SIZE
    hi = min(TOTAL, lo + SIZE) - 1
    path = ROOT / f'archive.part{index}'
    if path.exists() and path.stat().st_size == hi - lo + 1:
        return index
    prefix = ROOT / 'isa_BP3D_4.0_obj_99.zip'
    if prefix.exists() and prefix.stat().st_size > hi:
        with prefix.open('rb') as stream:
            stream.seek(lo)
            path.write_bytes(stream.read(hi - lo + 1))
        return index
    for retry in range(4):
        try:
            request = urllib.request.Request(URL, headers={'Range': f'bytes={lo}-{hi}'})
            with urllib.request.urlopen(request, timeout=45) as response:
                if response.status != 206:
                    raise RuntimeError('Source server did not honor the requested byte range')
                data = response.read()
            if len(data) != hi - lo + 1:
                raise RuntimeError('Incomplete source range')
            path.write_bytes(data)
            return index
        except Exception:
            if retry == 3:
                raise
            time.sleep(1 + retry)


def fetch_verified(name, url, expected_sha):
    path = ROOT / name
    if path.exists() and digest(path) == expected_sha:
        print('Verified cached source', name, flush=True)
        return
    staged = path.with_suffix(path.suffix + '.download')
    for retry in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as response, staged.open('wb') as output:
                for block in iter(lambda: response.read(1024 * 1024), b''):
                    output.write(block)
            if digest(staged) != expected_sha:
                raise RuntimeError(f'{name} differs from audited SHA256; review source changes before updating')
            os.replace(staged, path)
            print('Downloaded and verified', name, flush=True)
            return
        except Exception:
            if retry == 3:
                raise
            time.sleep(1 + retry)


def main():
    ROOT.mkdir(exist_ok=True)
    output = ROOT / 'bodyparts4-complete.zip'
    if not output.exists() or output.stat().st_size != TOTAL or digest(output) != ARCHIVE_SHA:
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs = [pool.submit(download_range, index) for index in range((TOTAL + SIZE - 1) // SIZE)]
            for job in as_completed(jobs):
                print('Completed source range', job.result(), flush=True)
        staged = ROOT / 'bodyparts4-complete.zip.download'
        with staged.open('wb') as target:
            for index in range((TOTAL + SIZE - 1) // SIZE):
                target.write((ROOT / f'archive.part{index}').read_bytes())
        if digest(staged) != ARCHIVE_SHA:
            raise RuntimeError('BodyParts3D archive differs from audited SHA256')
        with zipfile.ZipFile(staged) as archive:
            print('Verified archive entries:', len(archive.namelist()), flush=True)
        os.replace(staged, output)
    print('Verified BodyParts3D 4.0 archive:', ARCHIVE_SHA, flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(fetch_verified, *resource) for resource in RESOURCES]
        for job in as_completed(jobs):
            job.result()


if __name__ == '__main__':
    main()
