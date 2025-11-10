#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Generates all required PWA icons from a source image
 * Usage: node generate-icons.js [source-image]
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const ICON_SIZES = [
  72, 96, 128, 144, 152, 192, 384, 512
];

const APPLE_ICON_SIZES = [
  120, 152, 167, 180
];

const MASKABLE_SIZES = [
  192, 512
];

async function generateIcons(sourceImage = 'public/icon-source.png') {
  try {
    // Check if source exists
    await fs.access(sourceImage);
    
    // Create icons directory
    const iconsDir = 'public/icons';
    await fs.mkdir(iconsDir, { recursive: true });
    
    console.log('🎨 Generating PWA icons...');
    
    // Generate standard icons
    for (const size of ICON_SIZES) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✅ Generated ${outputPath}`);
    }
    
    // Generate Apple touch icons
    for (const size of APPLE_ICON_SIZES) {
      const outputPath = path.join(iconsDir, `apple-touch-icon-${size}x${size}.png`);
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✅ Generated ${outputPath}`);
    }
    
    // Generate maskable icons (with padding)
    for (const size of MASKABLE_SIZES) {
      const outputPath = path.join(iconsDir, `icon-maskable-${size}x${size}.png`);
      const padding = Math.round(size * 0.1); // 10% padding
      
      await sharp(sourceImage)
        .resize(size - padding * 2, size - padding * 2, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✅ Generated ${outputPath}`);
    }
    
    // Generate favicon.ico (multi-size)
    await sharp(sourceImage)
      .resize(32, 32)
      .toFile(path.join('public', 'favicon.ico'));
    console.log('✅ Generated favicon.ico');
    
    // Generate badge icon
    await sharp(sourceImage)
      .resize(72, 72)
      .png()
      .toFile(path.join(iconsDir, 'badge-72x72.png'));
    console.log('✅ Generated badge icon');
    
    console.log('🎉 All icons generated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const sourceImage = process.argv[2];
  generateIcons(sourceImage);
}

module.exports = generateIcons;
