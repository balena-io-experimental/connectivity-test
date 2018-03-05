#!/bin/bash

# Start Avahi
/usr/sbin/avahi-daemon -s &

node src/index.js
echo "Error code: $?"
while : ; do sleep 600; done
