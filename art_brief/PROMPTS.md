# Art brief: the Workshop thumbnail and the three technology icons

POLISH_1_0.md R2 (the thumbnail) and R5 (the icons). The prompts below are written for an image model that takes reference images. The
reference images are in `art_brief/references/` (gitignored: Paradox art and other authors' thumbnails, never committed).

**The single combined prompt** (all four images in one message, the eight attachments in a fixed order, for Nano Banana Pro) is published as
an Artifact: https://claude.ai/artifact/QWhvX9QMeepDnC21PuNMwJ. The sections below are the same content split into one prompt per image,
for a model that does better one image at a time.

## 0. Which model

**Recommended: Gemini with your Workspace account**, using its strongest image model (Google calls it "Nano Banana Pro", Gemini 3 Pro Image;
the Gemini app shows it when you pick the image tool and the Pro or "Thinking" model).
- It accepts many reference images in one message (Google says up to 14), keeps a style across a conversation, and spells a short title reliably.
- It does **not** make transparent backgrounds. The icons are therefore generated on flat green, and the green is removed here (§3).
- Workspace caveats: your admin must have the Gemini app switched on; a personal project on a work account may fall under your employer's
  acceptable-use policy, and uploads sit in the employer's tenant. Check for a small visible Gemini mark in a corner and crop or regenerate.

**Free fallback: ChatGPT (free tier).** Its image model can save a real transparent PNG, which suits the icons. Free accounts get only a few
images a day. The two Workshop thumbnails we take the style from look like its output.

Not recommended: Copilot/Bing Image Creator (little control over references); local Stable Diffusion or Flux (an evening of setup for four
images).

These are mid-2026 product names; the menus may call them something else.

## 1. The three technology icons

### What to attach

| attach | why |
|---|---|
| `references/tech_icons/_contact_sheet.png` | twelve vanilla technology icons on dark grey: the style to match |
| `references/tech_icons/pneumatic_tools.png` | Spray Finishing's prerequisite; same tree, same finish |
| `references/tech_icons/nitrogen_fixation.png` | Catalytic Synthesis's prerequisite; its new icon must not repeat this horizontal tube |
| `references/tech_icons/chemical_bleaching.png`, `shift_work.png` | Continuous Web Processing's prerequisites |

The other singles in `references/tech_icons/` are spares if the model drifts (one object at full resolution is easier to copy than a sheet).

### Measured from vanilla's icons (so you can judge the results)

256 × 256 px; one isolated object, no background, frame or text; 41–64% of the pixels fully transparent; the object's longer side
209–246 px of 256 (82–96%, most near 215); mean colour saturation 0.08–0.37 (muted); a soft **black** outer glow 7–12 px wide hugging the silhouette
(added here, not by the model); a thin pale rim light along the edges; three-quarter view from slightly above; soft key light from the
upper left; painted, near-photographic rendering with fine visible brushwork.

### Prompt 1a: open the conversation (attach the four images first)

```
I need three technology icons for a Victoria 3 mod. They must look as if Paradox's own artists painted them, side by side with the game's existing technology icons, which are attached (a sheet of twelve, and three singles).

Study the attached icons and match them exactly:
- one isolated object or a tight group of related objects, centred, filling about 85% of the square;
- painted, near-photographic digital painting with fine visible brushwork, not a 3D render and not a cartoon;
- three-quarter view from slightly above;
- soft key light from the upper left, gentle shading, a thin pale rim light along the silhouette;
- muted, low-saturation colours: weathered steel, brass, enamel, wood, paper, with small warm highlights;
- no ground plane, no cast shadow on the floor, no frame, no text, no labels, no logos, no watermark.

Output rules for every icon:
- square 1:1;
- the object on a perfectly flat, uniform pure green background (#00FF00), edge to edge, with no gradient, no vignette and no shadow on it;
- light the object as if it stood in a neutral grey studio: no green reflections, green tint or green spill on the object;
- keep a margin of green around the object on all four sides; nothing may touch the edge.

Reply only "ready" for now. I will send the three subjects one at a time.
```

### Prompt 1b: Spray Finishing

```
Icon 1 of 3: "Spray Finishing" (furniture making, about 1923).
Subject: a 1920s compressed-air spray gun, cast metal with a pistol grip and trigger, a round paint cup hanging below it and a short length of rubber air hose, held in mid-air at an angle, spraying a fine cone of lacquer mist onto the back of a wooden chair whose fresh finish is deep brown and glossy, with a visible wet sheen where the mist lands.
The gun is the hero and sits in front; the chair back is partly cropped behind it. The mist must stay readable when the icon is shown at 64 pixels: a clear soft cone, not haze over everything.
It must look different from the attached pneumatic tools icon (a drill on a tripod) and from the game's lathe and steam-hammer icons.
Same style and output rules as before: flat #00FF00 background, no text.
```

### Prompt 1c: Continuous Web Processing

```
Icon 2 of 3: "Continuous Web Processing" (paper making, about 1930).
Subject: a short section of a paper machine: two or three large polished steel drying cylinders in a cast-iron frame, with one unbroken white paper web running over and under them and winding onto a large, fat reel of finished paper in the foreground.
The paper reel is the hero: it is the clearest read at small size. The web must be one continuous ribbon, never separate sheets.
It must look different from the attached chemical bleaching icon (porcelain plates) and the shift work icon (a time clock).
Same style and output rules as before: flat #00FF00 background, no text.
```

### Prompt 1d: Catalytic Synthesis

```
Icon 3 of 3: "Catalytic Synthesis" (fertilizer chemistry, about 1937).
Subject: a tall VERTICAL high-pressure converter column of thick forged steel, banded and bolted, standing upright, with pipework leaving its top and side, one round pressure gauge and a small valve wheel; at its foot a small heap of white fertilizer pellets.
Keep the column upright and tall: the attached nitrogen fixation icon is a HORIZONTAL bolted tube, and the new icon must not repeat that shape. No sacks (the game's fertilizer icon is a sack).
Same style and output rules as before: flat #00FF00 background, no text.
```

Ask for three or four versions of each and pick; "same image, but …" fixes a detail without losing the rest.

### Checks before you hand them over

- Shrink each to 64 px on a dark background: is the object still recognisable?
- Put it beside its prerequisite's icon: same family, different shape?
- No green on the object itself, nothing touching the edge, no text or mark anywhere.

## 2. The Workshop thumbnail

### What to attach

| attach | why |
|---|---|
| `references/thumbnail/ws_state_assets_visualization.png` | an AI-made Workshop thumbnail: sepia engraving, serif title. The main style reference |
| `references/thumbnail/ws_headlines.png` | another: a blurred painted scene behind an ornate serif title |

**Do not attach** `ws_production_method_rework_DIFFER_FROM_THIS.png`. It belongs to *Production Method Rework*, a Workshop mod with a
similar name and subject. Models copy what they are shown, so keep it out of the prompt and only compare your result against it: ours must
not be mistakable for it at a glance (it is navy and gold Art Deco with a bar chart).

### Prompt 2

```
Create a square 1:1 Steam Workshop thumbnail for a Victoria 3 mod called "PM and Tech Rehaul". In this mod every technology step of an industry is a new building that must be built and paid for, so old factories lose their markets to newer ones.

Style: like the attached AI-made Workshop thumbnails: a vintage engraved print on aged paper, warm sepia and ink-brown linework with fine cross-hatching, cream highlights and one restrained accent colour, brick red. It must stay crisp and high-contrast when shown at 200 pixels.

Subject, the "tier ladder": four factories of the same industry standing on a broad stone staircase that rises from left to right, each one step higher, larger and more modern than the last:
1. a small timber-and-stone artisan workshop with a single crooked chimney (1836);
2. a brick steam mill with arched windows and a tall smoking chimney (1875);
3. a steel-framed works with sawtooth roof lights and several chimneys (1905);
4. a streamlined concrete-and-glass electric works, with power lines running to it from a hydroelectric dam in the distance (1940).
The leftmost workshop is dim and quiet, losing its market; the rightmost is lit and busy. Each step's riser carries its year in small engraved numerals: 1836, 1875, 1905, 1940.

Title in the top third, large, in cream serif capitals on two lines:
PM AND TECH
REHAUL
Spell it exactly like that. No other words except the four years.

Avoid: a dark navy background, gold Art Deco frames, bar charts, infographic bars and arrows (another mod in the same category looks like that); game screenshots or interface elements; logos; watermarks; any border heavier than a thin printed rule.
```

If the title comes out wrong, ask for the same image without text and add the title in Photopea (free, in the browser).

### Checks

- The title reads "PM AND TECH REHAUL", the years read 1836, 1875, 1905, 1940.
- Shrink it to 200 px: the four buildings and the title still read.
- Put it beside `ws_production_method_rework_DIFFER_FROM_THIS.png`: clearly a different mod.

## 3. What happens after (done here)

Save the images in `art_brief/out/` as `thumbnail.png`, `spray_finishing.png`, `continuous_web_processing.png` and `catalytic_synthesis.png`.
Then:
- **Icons:** `tools/make_tech_icon.mjs` keys out the green and its spill, scales the object to vanilla's 215 px inside a 256 × 256 canvas,
  adds vanilla's black glow and writes `art/invention_icons/<technology>.png`; `emit_techs.mjs` writes each as an uncompressed A8R8G8B8 DDS
  with the full mip chain, `gfx/interface/icons/invention_icons/zzz_pm_rehaul_<technology>.dds`, and the placeholder ships only for a
  technology without a picture. (Done 2026-10-26.)
- **Thumbnail:** `art/thumbnail.png`, square, under 1 MB (Steam's limit for a preview image), scaled down until it fits; `build.ps1`
  copies it to the mod root. (Done 2026-10-26: 736 × 736 px.)
- A build, the linters and one in-game look at the tech tree.
