# Trading School module images

`module-art.html` draws each module's 1920×1080 key image (Ben approved all 18 on 2026-11-02): a faint wall of candles
behind one picture of what the module teaches. `?n=` is the module's position, `?label=` the small tag top-left.

Render one with headless Chrome, then save it as `public/education/modules/<module id>.jpg` and list the id in
`src/lib/moduleArt.ts`:

    chrome-headless-shell --hide-scrollbars --window-size=1920,1080 --virtual-time-budget=4000 \
      --screenshot=m3.png "file://$PWD/scripts/module-art/module-art.html?n=3&label=MODULE%2003"
    sips -s format jpeg -s formatOptions 88 m3.png --out public/education/modules/<id>.jpg
