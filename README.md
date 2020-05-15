#ACNH-Server

This is a project to create a portable controller to manipulate the Nintendo Switch. It is, originally, designed to play AC:NH, though can be programmed with commands to do anything really

This project is not complete and currently provided exclusively as a resource.

#Things to note
1) Game control is done by simulating a Pro Controller over bluetooth. This requires a linux system -- I run it on a Raspberry Pi. This uses the "JoyControl" library.
2) Video input must be fed via some kind of capture card in order to handle state confirmation. I use a Avermedia Live Gamer Ultra.
3) The nodejs code in this library is setup for a windows system. Some things may need to be adjusted for cross-compatibility (such as ffmpeg's direct call)
4) Existing control implementations can be seen in the public/index.html JS, "automate()" routine.
5) The control device and host device need to be connected in an efficient manner to avoid timing variation. A small LAN or a direct ethernet cable is perfect.

#Setup
1) Start the node program on a host machine, with a connected capture card (uses port 80).
2) Configure the control emulator on a linux device (see JoyControl's page). (You'll need to record a SPI dump!)
3) Start the control emulator, ensuring you adjust the MAC Address and IP in the python file.
4) On the same network, navigate to the host machine's IP (127.0.0.1:80) to view control interface

