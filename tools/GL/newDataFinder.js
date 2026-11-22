import _ from 'lodash';
import fs from 'fs';

console.log("Starting");
let currentData = JSON.parse(fs.readFileSync('../../public/GL/data.json', {encoding: 'utf8'}));

let newDataArray = JSON.parse(fs.readFileSync('./data.json', {encoding: 'utf8'}));

let changes = {}

Object.keys(newDataArray).forEach(newData => {
    let noMatch = false;
    Object.keys(currentData).forEach(currentDataItem => {
        if (newDataArray[newData].id === currentData[currentDataItem].id) {
            noMatch = true;
            if (newDataArray[newData].name !== currentData[currentDataItem].name){
                console.log("Name Change For " + currentData[currentDataItem].name + " Detected");
                console.log(currentData[currentDataItem].name + " should be " + newDataArray[newData].name);
                changes[newDataArray[newData].id] = newDataArray[newData]
            }
        }
    });

    if (noMatch === false){
        console.log("ID's don't match")
        console.log(newDataArray[newData])
    } else {
        noMatch = false;
    }
})

//Mark items as released
Object.keys(changes).forEach((item) => {
    if (changes[item].access.includes("not released yet")){
        changes[item].access = ["released"];
    }else {
        console.log(changes[item])
    }
})

// let lastItemRelease = JSON.parse(fs.readFileSync('../../public/GL/lastItemReleases.json', {encoding: 'utf8'}));
// let newItemRelease = {}

// let newRelease = {
//     "date":"August the 18th, 2022",
//     "sources": [
//         {"type":"event", "ids": []},
//     ]
// }


// Gear can have an ID match, but the attributes be different, to allow for excluives, etc.
Object.keys(changes).forEach((changeItem) => {
    let newItem = true;
    Object.keys(currentData).forEach((currentDataItem) => {
        if(changes[changeItem].id === currentData[currentDataItem].id) {
            newItem = false;
            console.log(changes[changeItem].id + " already exists as: " + currentData[currentDataItem].name)

                changes[currentData[currentDataItem]] = currentData[currentDataItem]
                //newRelease["sources"][0]["ids"].push([changes[changeItem].id.toString()])
            }
        }
    )

    if (newItem === true) {
        changes[currentData[currentDataItem]] = currentData[currentDataItem]
    }
});


// newItemRelease = newRelease;

// Object.keys(lastItemRelease).forEach((index, release) => {
//     newItemRelease[lastItemRelease[index]] = lastItemRelease[release]

// });

// console.log(newItemRelease)

console.log(changes)

console.log("Writing to data.json...")
fs.writeFileSync('../../public/GL/changes.json', JSON.stringify(changes))
//fs.writeFileSync('../../public/GL/data.json', JSON.stringify(currentData))
//fs.writeFileSync('../../public/GL/lastItemReleases.json', JSON.stringify(newItemRelease))
console.log("Completed writing changes...")
console.log("Please verify changes are correct in data.json")