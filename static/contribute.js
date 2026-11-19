var currentItem;
var newItems = [];
var dataById = {};
var modifiedItems = {};

// Contributions are sent as GitHub issues (the site has no server). The forms are in .github/ISSUE_TEMPLATE.
const NEW_ISSUE_URL = 'https://github.com/dCurre/ffbe-equip-reborn/issues/new';
// GitHub rejects URLs that are too long (414): stay well below the limit
const MAX_ISSUE_URL_LENGTH = 7000;

function updateResults() {
    displayItems(filterContributeItems(removeModifedItems(data)));
    displayModifiedItems();
    lazyLoader.update();
}
                 
function removeModifedItems(data) {
    var notModifiedItems = [];
    for (var index = 0, len = data.length; index < len; index++) {
        var item = data[index];
        if (modifiedItems[item.id]) {
            // Only display unknown items
            continue;
        }
        notModifiedItems.push(item);
    }
    return notModifiedItems;
}

// Not named filterItems: that would override filterItems() of common.js, which filter() calls (infinite recursion)
function filterContributeItems(data) {
    var searchText = $("#searchText").val();
    if (!searchText) {
        return filterUnknowItems(data);
    } else {
        return filter(data, false, "", 0, searchText);
    }
}

function filterUnknowItems(data) {
    var unknowItems = [];
    for (var index = 0, len = data.length; index < len; index++) {
        var item = data[index];
        if (!item.access.includes("unknown")) {
            // Only display unknown items
            continue;
        }
        unknowItems.push(item);
    }
    return unknowItems;
}


function displayItems(items) {
    var html = "";
    for (var index in items) {
        var item = items[index];
        if (item) {
            html += '<div class="tr ' + item.id + '">';
            html += '<div class="td select"><span class="glyphicon glyphicon-edit clickable" onclick="modifyItem(\'' + item.id + '\')"></span></div>';
            html += displayItemLine(item);
            html += '<div class="td">' + (item.maxNumber ? item.maxNumber : "N/A") + "</div>";
            html += "</div>";
        }
    }
    
    $(".itemList #results .tbody").html(html);
}

function displayModifiedItems() {
    for (var id in modifiedItems) {
        var maxNumber = $("#modifiedItems .tr." + id + " input.maxNumber").val();
        if (maxNumber && !isNaN(parseInt(maxNumber))) {
            modifiedItems[id].maxNumber = parseInt(maxNumber);
        } else {
            delete modifiedItems[id].maxNumber;
        }
    }
    if (Object.keys(modifiedItems).length == 0) {
        $("#modifiedItems").addClass("hidden");
    } else {
        $("#modifiedItems").removeClass("hidden");
        var html = "";
        for (var itemId in modifiedItems) {
            var modifiedItem = modifiedItems[itemId];
            var item = dataById[itemId];
            if (item) {
                html += '<div class="tr ' + item.id + '">';
                html += getImageHtml(item);
                html += getNameColumnHtml(item);
                html += '<div class="td access"><div><span class="glyphicon glyphicon-edit clickable" onclick="openAddAccess(\'' + item.id + '\')"></span><div class="accessList">';
                for (var accesIndex = 0, accessLen = modifiedItem.access.length; accesIndex < accessLen; accesIndex++) {
                    html += '<div>' + modifiedItem.access[accesIndex] + '</div>';
                }
                html += "</div></div></div>";
                html += '<div class="td"><input class="maxNumber" type="number" onkeypress="return isNumber(event)" value="' + (modifiedItem.maxNumber ? modifiedItem.maxNumber : "") + '"/></div>';
                html += '<div class="td select"><span class="glyphicon glyphicon-remove clickable" onclick="cancelModification(\'' + item.id + '\')"></span></div>';
                html += "</div>";
            }
        }

        $("#modifiedItems .tbody").html(html);
    }
}

function modifyItem(itemId) {
    if (Object.keys(modifiedItems).length >=10 ) {
        Modal.showMessage("Modification error", "Only 10 items at most can be modified at a time. Please open an issue with the current items before continuing.");
        return;
    }
    var modifiedItem = {"access":[]};
    if (dataById[itemId].maxNumber) {
        modifiedItem.maxNumber = dataById[itemId].maxNumber;
    }
    for (var index = 0, len = dataById[itemId].access.length; index < len; index++) {
        if (dataById[itemId].access[index] != "unknown") {
            modifiedItem.access.push(dataById[itemId].access[index]);
        }
    }
    modifiedItems[itemId] = modifiedItem;
    updateResults();
}

function cancelModification(itemId) {
    delete modifiedItems[itemId];
    updateResults();
}


function openAddAccess(itemId) {
    var item = modifiedItems[itemId];
    if (item) {
        $("#accessList").data("id", itemId);
        unselectAll("accessList");
        select("accessList", item.access);
        $("#addAccessModal").modal();
    }
}

function setAccess(itemId, access) {
    var i = 0;
    while (i < modifiedItems[itemId].access.length) {
        if (modifiedItems[itemId].access[i].startsWith("TMR")) {
            i++;
        } else {
            modifiedItems[itemId].access.splice(i,1);
        }
    }
    modifiedItems[itemId].access = modifiedItems[itemId].access.concat(access);
    updateResults();
}

// Opens the GitHub "new issue" page in a new tab, with the given issue form and prefilled fields
// (field names are the ids defined in .github/ISSUE_TEMPLATE/<template>)
function openIssue(template, fields) {
    const params = new URLSearchParams(Object.assign({ template: template }, fields));
    const url = NEW_ISSUE_URL + '?' + params.toString();
    if (url.length > MAX_ISSUE_URL_LENGTH) {
        Modal.showMessage("Too much data", "The issue is too long to be prepared automatically. Please send fewer items at a time.");
        return false;
    }
    window.open(url, '_blank', 'noopener');
    return true;
}

function openFeedbackIssue(template) {
    openIssue(template, {});
}

function openCorrectionIssue() {
    const itemCorrections = [];
    for (var id in modifiedItems) {
        if (!modifiedItems[id].access || modifiedItems[id].access.length == 0) {
            Modal.showMessage("Access error", "Access cannot be empty");
            return;
        }
        var maxNumber = $("#modifiedItems .tr." + id + " input.maxNumber").val();
        if (maxNumber) {
            if (isNaN(parseInt(maxNumber))) {
                Modal.showMessage("Number of items", maxNumber + " is not a valid max number");
                return;
            }
            modifiedItems[id].maxNumber = parseInt(maxNumber);
        } else {
            delete modifiedItems[id].maxNumber;
        }
        const correction = { id: id, name: dataById[id].name, access: modifiedItems[id].access };
        if (modifiedItems[id].maxNumber) {
            correction.maxNumber = modifiedItems[id].maxNumber;
        }
        itemCorrections.push(correction);
    }
    if (itemCorrections.length === 0) {
        return;
    }

    const names = itemCorrections.map(correction => correction.name).join(', ');
    const opened = openIssue('data_correction.yml', {
        title: '[Data] ' + server + ': ' + (names.length > 80 ? names.substring(0, 77) + '...' : names),
        server: server,
        corrections: JSON.stringify(itemCorrections, null, 2)
    });
    if (opened) {
        Modal.showMessage("Almost done", "A GitHub page with the issue already filled in has been opened in a new tab. Please check it and click \"Submit new issue\" there. Thank you!");
    }
}

function showContributePage() {
    prepareSearch(data);
    updateResults();
    $("#contributeWrapper").removeClass('hidden');
}

// will be called by common.js at page load
function startPage() {
	getStaticData("data", true, function(result) {
        data = keepOnlyOneInstance(result);
        for (var index = data.length; index--;) {
            dataById[data[index].id] = data[index];
        }
        getStaticData("units", true, function(result) {
            units = result;
            showContributePage();
        });
    });
    
    // Reset search if escape is used
    $(window).on('keyup', function (e) {
        if (e.keyCode === 27) {
            $("#searchText").val('').trigger('input').focus();
        }
    });
    
    // Triggers on search text box change
    $("#searchText").on("input", $.debounce(300,updateResults));
    
    $('#addAccessModal').on('hidden.bs.modal', function(event) {
        var itemId = $("#accessList").data("id");
        setAccess(itemId, getSelectedValuesFor("accessList"));
    });
    addTextChoicesTo("accessList",'checkbox',{ 'Shop':'shop', 'Recipe':'recipe', 'Chest':'chest', 'Chest Recipe':'recipe-chest', 'Quest':'quest', 'Key':'key', 'Chocobo':'chocobo', 'Event':'event', 'Event Recipe':'recipe-event', 'Trial':'trial', 'Trophy':'trophy', 'Colosseum':'colosseum', 'Premium':'premium', 'STMR':'STMR', 'TMR 5*':'TMR-5*', 'TMR 4*':'TMR-4*', 'TMR 3*':'TMR-3*', 'TMR 2*':'TMR-2*', 'TMR 1*':'TMR-1*', 'Not released yet':'not released yet'});
}
  
function inventoryLoaded() {
}

function notLoaded() {
    
}
