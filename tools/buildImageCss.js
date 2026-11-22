/* 
 * FBBE Equip Script
 * Generates CSS files containing all image from specific folders as background Data URI
 * Good for performance (less HTTP request on server)
 * 
 * Image are found in public/img folder
 * Generated CSS are found in public/css-img folder
 * See the LISTING constants
 * 
 * Usage in code:
 *      <i class="img img-[CLASSNAME]-[IMGNAME]"></i>
 *         With:
 *            [CLASSNAME] depending on the CSS file
 *            [IMGNAME] depending on the desired image
 * 
 * By default, the icon has the same size as the image.
 * To resize it, you need to override *both* width/height rules by CSS.
 * 
 * Note: The generated CSS should be placed in HTML head before any 
 *       other css file (before common.css, for instance).
 *       It allows to easily override size rules.
 */


import fs from 'fs'
import path from 'path'
import * as imageSize from 'image-size'

const LISTING = [
    {
        className: 'banner',
        basePath: '../public/img/banner', 
        outPath: '../public/css-img/banner.css'
    },
    {
        className: 'homepage',  // there is already "background-" in the file name
        basePath: '../public/img/homepage/backgrounds', 
        outPath: '../public/css-img/homepage-backgrounds.css'
    },
    {
        className: 'homepage',
        basePath: '../public/img/homepage', 
        outPath: '../public/css-img/homepage.css'
    },
    {
        className: 'esper',
        basePath: '../public/img/espers', 
        outPath: '../public/css-img/espers.css'
    },
    {
        className: 'crystal',
        basePath: '../public/img/icons/crystals', 
        outPath: '../public/css-img/crystals.css'
    },
    {
        className: 'equipment',
        basePath: '../public/img/icons/equipments', 
        outPath: '../public/css-img/equipments.css'
    },
    {
        className: 'element',
        basePath: '../public/img/icons/elements', 
        outPath: '../public/css-img/elements.css'
    },
    {
        className: 'ailment',
        basePath: '../public/img/icons/ailments', 
        outPath: '../public/css-img/ailments.css'
    },
    {
        className: '', // there is already "sort" in the file name
        basePath: '../public/img/icons/sort', 
        outPath: '../public/css-img/sorts.css'
    },
    {
        className: 'killer',
        basePath: '../public/img/icons/killers', 
        outPath: '../public/css-img/killers.css'
    },
    {
        className: 'slot',
        basePath: '../public/img/icons/slots', 
        outPath: '../public/css-img/slots.css'
    },
    {
        className: 'tab',
        basePath: '../public/img/icons/tabs', 
        outPath: '../public/css-img/tabs.css'
    },
    {
        className: 'stat',
        basePath: '../public/img/icons/stats', 
        outPath: '../public/css-img/stats.css'
    },
    {
        className: 'access',
        basePath: '../public/img/icons/access', 
        outPath: '../public/css-img/access.css'
    },
    {
        className: 'tankAbilities',
        basePath: '../public/img/icons/tankAbilities', 
        outPath: '../public/css-img/tankAbilities.css'
    },
    {
        className: 'mitigation',
        basePath: '../public/img/icons/mitigationAbilities',
        outPath: '../public/css-img/mitigationAbilities.css'
    },
    {
        className: 'racialMitigations',
        basePath: '../public/img/icons/racialMitigationAbilities',
        outPath: '../public/css-img/racialMitigationAbilities.css'
    },
];

var CssTemplate = function(className, filename, dimensions, base64Data) {
    var fileparsed = path.parse(filename);
    var filenameNoExt = fileparsed.name;
    var filetype = fileparsed.ext.replace('.', '');

    if (className) className += '-';

    return `
.img-${className}${filenameNoExt} {
    width: ${dimensions.width}px; height: ${dimensions.height}px;
    background-image: url(data:image/${filetype};base64,${base64Data});
}`;
};

var BuildCssFromImgFolder = function(className, basePath, outPath) {
    console.log(`In folder ${basePath}...`);

    var filenames = fs.readdirSync(basePath);
    var CssContent = `
/* 
 * Generated on ${new Date(Date.now()).toString()}
 */\n`;

    filenames.forEach(function(name) {
        var currPath = path.join(basePath, name);

        if (fs.lstatSync(currPath).isDirectory()) return;

        console.log(`   Processing ${name}...`);

        try {
            var dimensions = imageSize.imageSize(currPath);
            var fileContentBase64 = (fs.readFileSync(currPath)).toString('base64');
        
            CssContent += CssTemplate(className, name, dimensions, fileContentBase64);
        } catch (err) {
            console.log("Wrong file type")
            console.log(err)
        }
    });

    fs.writeFileSync(outPath, CssContent, 'utf8');
};

for (let index = 0; index < LISTING.length; index++) {
    const element = LISTING[index];
    BuildCssFromImgFolder(element.className, element.basePath, element.outPath);
}
