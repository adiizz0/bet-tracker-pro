# Image Integration Testing Playbook

## Image Handling Rules
- Always use base64-encoded images OR real uploaded files for tests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do NOT use SVG, BMP, HEIC, or blank/solid-color images.
- Every image must contain real visual features (text, edges, objects).
- If not PNG/JPEG/WEBP, transcode to PNG/JPEG before upload.
- For animated images, extract the first frame only.
- Resize very large images to reasonable bounds.

## Endpoint under test
POST /api/bets/from-image  (multipart form field: file)
- Auth required (cookie access_token or session_token; Bearer fallback).
- Returns JSON: {sport, market, selection, stake(number), odds(number), result, bookmaker, date}
- result normalized to one of: win|lose|void|half_win|half_lose|pending

## How to create a valid test bet-slip image (Python + PIL)
```python
from PIL import Image, ImageDraw
img = Image.new('RGB',(600,400),'white')
d = ImageDraw.Draw(img)
for i,ln in enumerate(['BET365','Sport: Labdarugas','Arsenal - Chelsea','Tipp: Arsenal (1)','Tet: 5000 Ft','Odds: 2.10','Statusz: Fuggoben']):
    d.text((30,20+i*40), ln, fill='black')
img.save('/tmp/slip.png')
```

## Expected
- HTTP 200, stake=5000, odds=2.1, sport contains "Labdarúgás", result="pending".
