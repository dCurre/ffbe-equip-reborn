// Contributions are sent as GitHub issues (the site has no server). The forms are in .github/ISSUE_TEMPLATE.
const NEW_ISSUE_URL = 'https://github.com/dCurre/ffbe-equip-reborn/issues/new';

// Opens the GitHub "new issue" page in a new tab with the given issue form (.github/ISSUE_TEMPLATE/<template>)
function openFeedbackIssue(template) {
    window.open(NEW_ISSUE_URL + '?' + new URLSearchParams({ template: template }).toString(), '_blank', 'noopener');
}

// will be called by common.js at page load
function startPage() {
    $("#contributeWrapper").removeClass('hidden');
}

function inventoryLoaded() {
}

function notLoaded() {
}
