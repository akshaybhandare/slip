---
version: alpha
name: Orderful Modern
description: A clean, light B2B SaaS system with editorial typography and a vivid orange-red accent.
colors:
  primary: "#e42b0c"
  primary-contrast: "#ffffff"
  secondary: "#000000"
  tertiary: "#f5f5f5"
  neutral: "#ffffff"
  surface: "#ffffff"
  background: "#f5f5f5"
  on-surface: "#000000"
  muted: "#4f5b6b"
  border: "#e9e9e9"
  error: "#e42b0c"
typography:
  headline-display:
    fontFamily: Telegraf
    fontSize: 60px
    fontWeight: 300
    lineHeight: 60px
    letterSpacing: -1.8px
  headline-lg:
    fontFamily: Telegraf
    fontSize: 46px
    fontWeight: 300
    lineHeight: 55px
    letterSpacing: -0.72px
  headline-md:
    fontFamily: Telegraf
    fontSize: 35px
    fontWeight: 300
    lineHeight: 42px
    letterSpacing: -0.6px
  headline-sm:
    fontFamily: Telegraf
    fontSize: 26px
    fontWeight: 300
    lineHeight: 31px
  body-lg:
    fontFamily: Telegraf
    fontSize: 20px
    fontWeight: 300
    lineHeight: 28px
  body-md:
    fontFamily: Telegraf
    fontSize: 16px
    fontWeight: 300
    lineHeight: 24px
  body-sm:
    fontFamily: Telegraf
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label-lg:
    fontFamily: Telegraf
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0px
  label-md:
    fontFamily: Telegraf
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Telegraf
    fontSize: 10px
    fontWeight: 500
    lineHeight: 12px
    letterSpacing: 0.08em
  caption:
    fontFamily: Telegraf
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  nav-link:
    fontFamily: Telegraf
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0.04em
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 54px
  gutter: 32px
  section: 56px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-contrast}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 40px
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 40px
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.none}"
    padding: 0px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 32px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 8px 12px
# Orderful Modern

## Overview
Orderful feels crisp, minimal, and highly credible: a polished B2B SaaS brand aimed at operations and supply-chain teams who need confidence more than ornament. The page uses a spacious, light canvas with strong typographic hierarchy and one energetic accent color to keep the experience efficient and modern. The emotional tone is professional and optimistic, with just enough visual punch to signal speed and momentum.

## Colors
- **Primary (#e42b0c):** A vivid orange-red used for the main CTA, brand accents, focus moments, and status highlights. It provides the strongest visual energy in the system and should stay reserved for actions and key emphasis.
- **Secondary (#000000):** True black used for headlines, navigation, logos, and structured UI text. It gives the interface its editorial sharpness and high contrast.
- **Background (#f5f5f5):** A soft off-white page background that slightly warms the canvas and prevents the layout from feeling stark. Use it for the app shell and broad section backplates.
- **Surface (#ffffff):** White card and panel surfaces that sit above the background with subtle separation. This is the default container color for content blocks.
- **On-surface (#000000):** The primary text color for content on white surfaces. It supports the brand’s clear, confident tone.
- **Muted (#4f5b6b):** A restrained blue-gray used for supportive body copy, secondary labels, and less prominent interface information.
- **Border (#e9e9e9):** A very light neutral border tone for dividing surfaces without adding heaviness. It should be used sparingly and remain understated.
- **Primary-contrast (#ffffff):** The text and icon color on the accent button and other primary action surfaces.
- **Error (#e42b0c):** Matches the primary accent, so destructive or alerting states should feel consistent with the brand’s bright red-orange language rather than introducing a second warning hue.

## Typography
Telegraf defines the brand voice: slim, modern, and editorial, with light weights dominating headings and large text. Headline scales use 300 weight and tight negative letter spacing to create a refined, high-end SaaS impression, while body copy remains airy and readable at 20px or 16px with comfortable line height.

Use `headline-display`, `headline-lg`, and `headline-md` for page heroes and section intros; they should feel spacious and authoritative. `body-lg` and `body-md` support the main marketing narrative, especially on landing pages where statements are concise and persuasive. `label-lg`, `label-md`, and `label-sm` should handle buttons, navigation, badges, and metadata; nav text often appears slightly tracked and uppercase-like in feel, even when not fully uppercase, to reinforce a structured system.

Keep punctuation and line breaks deliberate. The design benefits from short lines, strong hierarchy, and minimal typographic clutter rather than dense copy blocks.

## Layout
The page uses a wide, centered marketing container with large internal cards and generous white space between modules. Content is organized into broad horizontal bands: a hero split, a social-proof strip, and subsequent feature/content sections. The rhythm is based on an 8px system, but the visible feel is driven by larger jumps at 24px, 40px, and 54px for section separation and breathing room.

Cards and large panels use consistent 32px internal padding, with enough room for oversized headings and illustration-heavy layouts. Navigation items are compact and horizontally distributed, while primary content blocks are expansive and balanced to keep the page airy rather than dense. Prefer fixed-max-width composition with large gutters over fluid, edge-to-edge layouts.

## Elevation & Depth
The system is intentionally flat in its treatment of shadows, relying more on white surfaces, faint borders, and contrast to create hierarchy. Depth comes from spacing, panel separation, and the juxtaposition of black editorial imagery against a pale background. When elevation is needed, keep it subtle and soft; avoid dramatic blur or layered shadow stacks.

## Shapes
The corner language is restrained and slightly softened. Interactive controls sit around 6px radii, while cards feel a touch rounder at 8px, and pills/chips can become fully rounded for compact labels. The overall shape feel is clean and architectural, with enough softness to feel modern but not playful.

## Components
Buttons are the clearest expression of the brand. `button-primary` should be the default CTA: solid `#e42b0c`, white text, 12px by 24px padding, 40px height, and a 6px radius. It should feel assertive and compact, with no shadow. `button-secondary` is a quiet outlined option using black text and border on transparent background. `button-tertiary` and link-style actions should remain minimal, with no container chrome and only the necessary emphasis.

Cards should use the `card` pattern: white background, very subtle border treatment, 8px radius, and 32px padding. They should support content-heavy marketing blocks without drawing attention away from the message. Keep card content aligned, with strong internal spacing and clear typographic hierarchy.

Inputs should be simple, white, and unobtrusive. Use a 6px radius, modest padding, and a clean border so form fields feel consistent with the button language. Focus states should be visible through color or border emphasis, not heavy shadows.

Chips and small pills should be compact and rounded, often fully pill-shaped, with label-sized type and restrained padding. Navigation items behave like lightweight chips or text buttons: they should read cleanly, remain evenly spaced, and avoid visual weight unless active. Any logos, badges, or trust markers should stay monochrome or near-monochrome so the accent color remains reserved for conversion moments.

## Do's and Don'ts
- Do keep the page spacious and editorial, with large headline treatment and generous white space.
- Do reserve `#e42b0c` for primary actions, highlights, and selected states.
- Do use Telegraf light weights for hero and section headlines to preserve the brand’s refined tone.
- Do keep surfaces white and backgrounds softly off-white for subtle contrast.
- Don't introduce heavy shadows, gradients, or skeuomorphic depth.
- Don't use multiple bright accent colors; the system should feel focused and disciplined.
- Don't crowd cards or nav items with excessive padding changes or inconsistent spacing.
- Don't make buttons overly rounded or oversized; keep them compact and precise.
