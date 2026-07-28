Airbnb Management Tabs UI Update v3.0.20

Copy these files into the root of the airbnb repository and overwrite the existing files:

- src/components/ParkingExtension.tsx
- public/sw.js

Changes:
- Rebuilds the main management navigation as a responsive equal-width grid.
- 2 columns on phones, 3 on small tablets, 4 on laptops, and 7 equal columns on wide desktop screens.
- Gives every tab the same minimum height, padding, alignment, and text wrapping.
- Removes the active-tab scale jump that made one tab appear larger than the others.
- Keeps Parking Guide before Manage Data & Access.

No Firestore or Storage rule changes are required.
