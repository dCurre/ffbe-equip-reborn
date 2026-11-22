#!/bin/bash

node initReleasedUnits.js
cp releasedUnits.json ../../public/JP
node parseUnits.js
cp unit* ../../public/JP
node parseItems.js
cp data* ../../public/JP
cp visionCards.json ../../public/JP
