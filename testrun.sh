#!/bin/bash

# Start Avahi
/usr/sbin/avahi-daemon -s &

if [ -n "IDLE" ]; then
  while : ; do
    echo "Not running tests, just idling..."
    sleep 60;
  done
else
  node src/index.js
  echo "Error code: $?"
  while : ; do sleep 600; done
fi
