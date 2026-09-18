# Tool Manager Buddy

This is my vision-based buddy made for the YSWS from Hack Club called [Buddy](https://buddy.hackclub.com/shop.html). It detects tools on my wall in real time using the browser camera, and gives voice feedback whenever a tool is picked up or returned, depending on how many tools are on the table. It also shows the tool status on screen.

## How it works

- The browser captures video from the user's camera.
- The video is streamed to Roboflow via WebRTC for real-time inference using my custom-trained object detection model.
- Roboflow returns predictions over the same WebRTC channel.
- The app draws detection boxes over the video and compares the current state with the previous one to detect changes.
- When it detects a stable change, it announces it by voice using the Web Speech API and updates the side status panel.

## Deployed version

[Here](https://tool-manager-buddy.vercel.app) you can try it as a web version.

**Note: it is trained to work with my custom model/tools.**