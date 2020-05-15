#!/bin/bash

#https://superuser.com/questions/461546/run-a-python-script-in-background-and-restart-it-on-crash
until ctrl.py; do
    echo "'ctrl.py' crashed with exit code $?. Restarting..." >&2
    sleep 1
done
