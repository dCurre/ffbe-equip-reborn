// Shared page header (title, login status, menu, theme/language/server buttons) and footer.
// Loaded synchronously, as a classic script, at the spot where the markup used to be, so the elements
// exist before the scripts that follow (common.js drives #inventoryDiv, the menu links, ...).
// Usage: <script src="layout.js" data-part="header" data-page="units.html" data-title="Units"
//                data-header-class="headerRain"></script>
//        <script src="layout.js" data-part="footer"></script>
(function () {
    var script = document.currentScript;
    var data = script.dataset;

    var MENU = [
        ['/', 'Home'],
        ['builder.html', 'Unit builder'],
        ['encyclopedia.html', 'Encyclopedia'],
        ['unitSearch.html', 'Unit Search'],
        ['inventory.html', 'My inventory'],
        ['units.html', 'My units'],
        ['espers.html', 'My Espers'],
        ['contribute.html', 'Contribute']
    ];
    var LANGUAGES = ['en', 'zh', 'ko', 'fr', 'de', 'es'];

    function desktopMenu() {
        return MENU.map(function (item) {
            var active = item[0] === data.page ? 'class="active" ' : '';
            return '<a ' + active + 'href="' + item[0] + '" data-internal-link="' + item[0] + '">' + item[1] + '</a>';
        }).join('');
    }

    function mobileMenu() {
        return MENU.map(function (item) {
            var active = item[0] === data.page ? ' class="active"' : '';
            return '<li' + active + '><a href="' + item[0] + '" data-internal-link="' + item[0] + '">' +
                '<span class="glyphicon glyphicon-chevron-right"></span> ' + item[1] + '</a></li>';
        }).join('');
    }

    function header() {
        return '<div id="header" class="' + data.headerClass + '">' +
            '<div class="headerContent">' +
                '<div class="headerTitle">' + data.title + '</div>' +
                '<div id="inventoryDiv" class="btn-group Inventoryloading" role="group">' +
                    '<button type="button" class="btn btn-default logOut" onclick="unloadInventory()">' +
                        '<span class="glyphicon glyphicon-off" title="logout"></span></button>' +
                    '<button type="button" class="btn btn-default loadInventory" onclick="loadInventory()">Log in</button>' +
                    '<button type="button" class="btn btn-default inventoryStatus">' +
                        '<span class="status loading">Loading inventory</span>' +
                        '<span class="status loaded">Inventory loaded</span>' +
                        '<span class="status notLoaded">Inventory not loaded</span>' +
                        '<div class="loader"></div>' +
                        '<span class="label label-default unitsNumber">? units</span>' +
                        '<span class="label label-default itemsNumber">? items</span>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="navigationMenu">' +
                '<div class="desktop">' +
                    '<div class="menuLogo" onclick="window.location.href=\'./\' + (server == \'GL\' ? \'\' : \'?server=\' + server)" title="Return to homepage"></div>' +
                    desktopMenu() +
                '</div>' +
                '<div class="mobile">' +
                    '<div class="menuLogo dropdown-toggle" data-toggle="dropdown"><span class="glyphicon glyphicon-chevron-down"></span></div>' +
                    '<ul class="dropdown-menu">' + mobileMenu() + '</ul>' +
                '</div>' +
            '</div>' +
            '<div class="headerTopButtons">' +
                '<div id="themeSelector"><span class="title">Theme :</span>' +
                    '<select class="form-control smallSelect"><option value="light">Light</option><option value="dark">Dark</option></select>' +
                '</div>' +
                '<div id="languages">' + LANGUAGES.map(function (lang) {
                    return '<span class="lang lang-sm" lang="' + lang + '" onclick="switchToLanguage(\'' + lang + '\')"></span>';
                }).join('') + '</div>' +
                '<div class="switchServer btn-group">' +
                    '<button class="GL btn btn-default" onclick="switchTo(\'GL\')">GL</button>' +
                    '<button class="JP btn btn-default" onclick="switchTo(\'JP\')">JP</button>' +
                '</div>' +
            '</div>' +
            '<div class="bannerBackground"></div>' +
            '<div class="bannerPicture"></div>' +
            '<div class="bannerPicturePerson"></div>' +
        '</div>';
    }

    function footer() {
        return '<div class="footerButtons"><div>' +
                '<a class="buttonLink" href="https://github.com/dCurre/ffbe-equip-reborn" target="_blank" rel="noreferrer">See code on GitHub</a>' +
                '<a class="buttonLink" href="https://github.com/dCurre/ffbe-equip-reborn/issues" target="_blank" rel="noreferrer">Report an issue</a>' +
                '<a class="buttonLink" href="privacy.html">Privacy</a>' +
            '</div>' +
            '<p class="footerCredits">Built on <a href="https://github.com/lyrgard/ffbeEquip" target="_blank" rel="noreferrer">FFBE Equip</a> by Lyrgard and ' +
            '<a href="https://github.com/sailorsben/ffbeEquip" target="_blank" rel="noreferrer">FFBE Equip Next</a> by Ben Sailors: a huge thank you to them and to all their ' +
            'contributors for years of outstanding work for the community. FFBE Equip Reborn is maintained by dCurre. Unofficial fan project, not affiliated with Square Enix.</p>' +
        '</div>';
    }

    script.insertAdjacentHTML('beforebegin', data.part === 'footer' ? footer() : header());
})();
