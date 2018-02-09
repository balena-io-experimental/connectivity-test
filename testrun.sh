#!/bin/bash

node src/index.js
echo "Error code: $?"
while : ; do sleep 600; done
