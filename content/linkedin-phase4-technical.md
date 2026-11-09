# Phase 4 LinkedIn draft: technical decisions

Status: Draft. Add a recording of the running app before publishing.

## Feed post

I added a browser to my flight-booking agent while keeping booking permission in the existing core.

Three decisions shaped the build:

- I revised the UI plan. The deliverable was a recorded demo, so I built in the repository and connected directly to the agent.
- I kept the permission gate separate from presentation. The browser showed decisions and carried answers back to the server.
- I reused the human-answer interface. Keyboard input and scripted replies already used it. Browser approval became another implementation.

The core classification, oversight, and simulated booking tests stayed unchanged during the browser work. I also inspected the new server for real-order calls.

That gave me evidence about the booking boundary. It did not replace checking the interface itself, which I still reviewed largely by hand.

Search uses live flight data. Every booking is simulated.

#AgenticAI #ProductDesign #BuildingInPublic #HumanInTheLoop

## First comment

Where do you keep permission policy when one agent needs several input surfaces?

## Alternate opening

I revised a recorded UI decision when the deliverable changed what I needed from the tool.
