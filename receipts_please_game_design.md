# Receipts, Please

## Game design and production plan

## 1. Final concept

Receipts, Please is a five minute browser 3D comedy game about reviewing increasingly absurd company expenses.

The player sits at a finance desk and manually reviews receipts, transactions, employee details, Slack messages, travel itineraries, vendor records, and inventory data. The first half is intentionally stressful. Information is split across several badly organized tools, receipts pile up, employees interrupt, and the player must catch obvious and subtle fraud under time pressure.

Halfway through the game, the company completes its migration to Ramp. The same office, cases, and controls remain, but the workflow changes. Receipts are matched automatically, policy issues are surfaced, travel data is connected, suspicious vendors are highlighted, and only cases that need judgment remain.

The point is not to show Ramp through an advertisement. The player should feel the difference between manual expense work and a unified finance platform through the game itself.

Recommended title: Receipts, Please

Backup title: Expenses, Please

Receipts, Please is funnier, more tactile, and more immediately communicates the Papers, Please inspiration. Expenses, Please is more accurate to the full Ramp product, but less memorable.

## 2. Player fantasy

The player fantasy changes during the five minute session.

At first, the player is an underpaid finance employee trying to survive a broken process.

After the Ramp migration, the player becomes an investigator with strong tools, clean information, and the power to freeze cards, reject vendors, and expose fraud.

The emotional curve is:

1. Confusion
2. Learning
3. Overload
4. Near failure
5. Ramp migration
6. Relief
7. Competence
8. Corporate absurdity
9. Final giraffe reveal

## 3. Five minute structure

### 0:00 to 0:20, cold open

The game begins immediately at the desk. No traditional tutorial screen.

The player sees:

- A receipt already in hand
- A transaction open on the main monitor
- Three physical trays labeled Approve, Reject, and Investigate
- A hardcoded expense policy on a sticky note
- A Slack message from the finance manager saying, "Need these cleared before lunch"
- An inbox count that starts at 12 and slowly rises

A brief ghost hand demonstrates dragging the receipt into a tray. The player is then left alone.

### 0:20 to 2:10, manual review

The player completes six to eight short cases. Each case should take 10 to 15 seconds.

The opening is intentionally hard because information is fragmented across multiple windows and physical papers. It must still be fair. Each case has one main clue and, at most, one optional secondary clue.

### 2:10 to 2:35, breakdown and migration

The printer begins ejecting receipts too quickly. Slack messages stack up. The desk starts shaking. The inbox count jumps from around 20 to 47.

The finance manager sends a Ramp migration-ready notification after the manual queue. The game presents exactly one prominent top-left action: **Install Ramp**. It has no dismiss or secondary action.

The player clicks Install Ramp. Workstation focus exits, the camera and desk shake, and the migration controller takes over the same office.

The monitors go black. The lights flicker. A short migration sequence appears. In `/game`, its bars and status changes advance at a readable automatic cadence after the install click; in `/scene-lab`, each connection remains explicitly player-driven for review:

- Importing cards
- Matching receipts
- Applying company policy
- Syncing travel
- Connecting vendors
- Reviewing transactions
- 47 expenses checked
- 6 need attention

In `/game`, all six stages advance automatically after that single click. After the final stage, the office changes from its dark, stressful manual state to clean bright practical lighting and powers back on with the Ramp workflow. The supplied `public/brand/low-cortisol.jpeg` image briefly fades in and out; it is a relief beat, not a separate ad or title screen. `/scene-lab` retains player-driven stage advancement for production review.

### 2:35 to 4:40, Ramp investigation

Ramp automatically handles the six richer cases in the Builders Cup demo, visibly completing surfaced control actions and correct judgments while advancing the exception queue. This automated run follows the single Install Ramp click and keeps the connected evidence visible as it works.

The game becomes calmer and more powerful, showing the contrast through completed work rather than asking for another interaction loop.

### 4:40 to 5:00, ending

The inbox reaches zero. The office becomes quiet. The player leans back. The Low Cortisol meter reaches 100 percent.

A Slack message appears automatically after the Ramp queue completes:

CEO: urgent

CEO: why did my card decline

The blocked charge opens automatically:

Merchant: Exotic Livestock International
Amount: $280,000
Category: Recruiting
Memo: High-level hire
Result: Declined automatically

The CEO sends another message:

CEO: can you make a one time exception

CEO: he already started monday

A giraffe slowly rises outside the office window wearing a company badge that says Chief Growth Officer.

Cut to the title card.

## 4. Core interaction loop

For every case, the player performs four actions:

1. Inspect the receipt or supporting document
2. Compare it against one or more digital records
3. Use the calculator or investigation tools when useful
4. Approve, reject, or investigate

The player should never need to type. All interactions are mouse driven.

Core controls:

- Left click to grab and interact
- Drag to move receipts and documents
- Right click and drag to rotate a document
- Scroll to zoom while holding a document
- Click monitor tabs to switch views
- Drag document values into calculator slots
- Drag a case into Approve, Reject, or Investigate
- Click the freeze card button when Ramp surfaces that action
- Press Escape to release an object or close a focused view
- In the seated first-person desk view, drag to turn left or right through a constrained forward-office arc. The player must not rotate far enough to expose the intentionally open rear of the internal environment.

Documents should snap into useful positions. Physics should look loose while actually being constrained.

## 5. Manual review cases

The demo should include the funniest and clearest puzzles. Do not include every idea if it hurts pacing.

### Case 1, amount mismatch

Transaction:

Chopped, $18.40

Receipt:

Chopped, $81.40

The first digit has been drawn over with a pen.

Purpose: Teach receipt to transaction matching.

### Case 2, impossible date

The receipt is from three days before the employee joined the company.

Purpose: Teach employee metadata comparison.

### Case 3, omakase intern

A summer intern expenses a $684 omakase dinner.

Memo: Executive relationship dinner

Attendees: Me

Company meal policy: $35 per person

Purpose: Introduce policy and character comedy.

### Case 4, infinite tip

Food: $21.80

Tip: $980.00

Memo: Investing in the relationship

The calculator can show a 4,495 percent tip.

### Case 5, Frankenstein receipt

The merchant name is Helvetica. The subtotal is Times New Roman. The total is Comic Sans. The tax line is rotated slightly. The last four digits of the card use a different font weight.

The player clicks two suspicious regions, then rejects the receipt.

### Case 6, garbage receipt

A blurry photo of a napkin says:

7 laptop
$14,000
paid
trust me

Merchant: Dave

### Case 7, duplicate receipt ring

Three interns submit the same Chipotle receipt with different crops, rotations, stains, and memos.

Possible memos:

- Cross-functional offsite
- External stakeholder lunch
- Team culture activation

The first may be valid. The others are duplicates.

### Case 8, AI generated receipt

The receipt includes:

- February 31
- Two currencies
- A restaurant address in the Atlantic Ocean
- Lorem ipsum under Payment Method
- A subtotal that does not add up

### Required demo case, self-approved vendor

An employee submits a $12,000 invoice from Totally Separate Consulting LLC for expense-policy consulting.

The fragmented records show:

- The employee is Jordan Blake
- The vendor's beneficial owner and payout-bank beneficiary are Jordan Blake
- Jordan submitted and approved the invoice
- The employee and vendor records share the same address and bank-account ending

Player action: Fire. Reject is not sufficient because the evidence documents deliberate self-dealing by a finance employee who controls approvals.

### Optional manual cases

Use these only if the pacing allows:

- Taxi receipt in New York while the employee claims to be in London
- Hotel minibar labeled Workspace supplies
- Client dinner attendee listed as the employee's dog
- Same receipt submitted by two different departments
- Receipt total exceeds policy by one cent, creating a deliberately annoying edge case

## 6. Ramp era cases

### Case 9, IT inventory theft

Purchase records:

- 24 MacBooks
- 40 monitors
- 90 keyboards

Inventory records:

- 11 MacBooks
- 19 monitors
- 143 keyboards

Ramp surfaces:

- Missing serial numbers
- A new resale vendor account
- The seller email matches the IT director's work email
- The keyboard count was accidentally imported by weight

Player actions:

- Freeze card
- Flag transaction
- Escalate employee

Presentation:

The UI places purchase order, invoice, asset inventory, and resale listing on one investigation board. Red lines animate between related values.

### Case 10, influencer marketing deal

Payment:

$75,000 to SynergyAlphaWolf Media LLC

Deliverable:

One vibe-based activation

Ramp surfaces:

- Vendor created yesterday
- Vendor address matches the marketing director's apartment
- Social account has 14 followers
- Eight followers are the marketing director
- Required legal approval is missing
- Campaign report contains three likes

The calculator can show $5,357 per verified follower.

### Case 11, Ramp Travel impossibility

Approved trip:

New York to Chicago, June 18 to June 20

Submitted charges:

- Chicago hotel
- Miami limousine
- Tokyo room service
- Monaco helicopter transfer
- Newark airport convenience store

Ramp Travel displays the itinerary and maps every charge to its location and time.

Employee explanation:

Long layover

### Case 12, AI expense paradox

Original expense:

Client coffee, $8.50

Processing costs:

- AI receipt enhancement, $4.10
- AI memo generator, $7.80
- AI policy interpretation, $9.20
- AI fraud analysis, $12.40
- AI summary of fraud analysis, $6.70
- AI agent evaluating the summary, $11.30

Total review cost: $51.50

Player action:

Approve the coffee and cancel the AI vendor.

After cancellation, the vendor creates a final $3.20 charge for generating the cancellation confirmation.

### Case 13, procurement mismatch

Purchase order:

100 ergonomic office chairs

Invoice:

1,000 ergonomic office chairs

Delivery confirmation:

1 beanbag

Inventory:

0 chairs, 1 suspiciously expensive beanbag

Memo:

Phased rollout

### Case 14, intern card catastrophe

Ramp surfaces an intern with:

- Seven active cards
- A $40,000 monthly limit
- One forklift
- 600 company hoodies
- A pallet of energy drinks
- One alpaca categorized as Employee engagement
- A recurring charge to DefinitelyNotDraftKings LLC

Approval metadata:

Approved by: CEO
Reason: Let them cook

## 7. Hardcoded expense policy

The demo policy should be simple enough to memorize but broad enough to support the cases.

Display it on a physical policy sheet during the manual section and as structured policy chips after Ramp migration.

Policy:

- Meals are limited to $35 per attendee
- Tips above 25 percent require review
- Travel expenses must match an approved trip
- Technology purchases require inventory records
- New vendors above $10,000 require legal and finance approval
- Intern card limits may not exceed $500 per month
- Receipts must match transaction amount, merchant, and date
- Duplicate receipts are prohibited
- Personal purchases are prohibited
- Livestock requires executive and facilities approval

The final livestock rule can either be present in tiny text from the start or appear only after the giraffe charge. Including it in tiny text creates a replay joke.

## 8. Calculator design

The calculator is a physical desk tool, not a programming language.

The player drags values from receipts or UI fields into two or more slots. The calculator provides a few large operation buttons.

Operations:

- Difference
- Sum
- Percentage
- Divide
- Quantity times unit price
- Compare date
- Compare location
- Compare text

Examples:

- Tip divided by subtotal times 100
- Receipt total minus transaction total
- Campaign cost divided by verified followers
- Sum of AI review costs divided by original expense
- Invoice quantity minus delivered quantity

The calculator prints a small paper tape with the result. The player can drag the tape onto the case as evidence.

Calculator feedback should be funny but concise:

- 4,495 percent tip. Concerning.
- $5,357 per follower. Premium audience.
- Review cost is 6.06 times the expense.
- 999 chairs are currently unaccounted for.
- Locations are 6,686 miles apart.

## 9. Views and operating system design

Use React Three Fiber for the 3D world and Drei Html for all readable interfaces. The user-facing workstation is named **Expense OS**. The monitors remain 3D objects, but the screen content is rendered as normal HTML mounted through the monitor's authored screen anchor so it inherits the bezel, focus animation, and parent transforms without a duplicate background screen.

The player should feel like they are using a small finance operating system rather than switching to a separate web application. `/game` and `/scene-lab` mount the same full Expense OS component and case store; the game must not substitute a visually similar second implementation.

### Main desktop shell

Persistent elements:

- Top bar with time, inbox count, and cortisol meter
- Left dock with application icons
- Slack notification area
- Current employee avatar and name
- Current case number
- Sound and pause controls

### Manual system applications

#### Transactions

Fields:

- Merchant
- Amount
- Date and time
- Card last four digits
- Employee
- Category
- Memo
- Transaction status

The manual version should look outdated and fragmented. Important details can be split across tabs.

#### Employee Directory

Fields:

- Name
- Role
- Department
- Manager
- Start date
- Office location
- Card limit
- Current monthly spend
- Recent transactions
- Employment status

#### Slack

Use a compact Slack-inspired messenger, not a full clone.

Channels and DMs:

- Finance Ops
- Travel Help
- IT Inventory
- Direct messages from employees
- Direct messages from CEO

Slack provides jokes, pressure, and explanations. Notifications should sometimes cover a corner of another app during the manual section.

#### Policy PDF

A basic document viewer containing the hardcoded policy. It is intentionally inconvenient before Ramp.

#### Travel Portal

Before Ramp, this is a separate app with approved bookings. The player must manually compare it against transactions.

#### Inventory Sheet

A spreadsheet-like view for serial numbers, assigned employees, and asset status.

### Ramp system applications

After migration, the operating system keeps the same shell but replaces the fragmented apps with one unified Ramp workspace.

#### Case Overview

Shows:

- Receipt and transaction match
- Policy status
- Employee
- Merchant
- Risk flags
- Recommended action
- Supporting evidence

#### Employee Spend Profile

Shows:

- Monthly spend
- Card limits
- Recent anomalies
- Similar prior expenses
- Approval history
- Active cards

#### Travel

Shows:

- Approved itinerary
- Hotel and flight details
- Travel dates
- Map pins for submitted transactions
- Out of trip charges

#### Vendor

Shows:

- Vendor creation date
- Address
- Owner
- Related employees
- Contract and approval status
- Historical company spend
- Duplicate bank details

#### Procurement and Inventory

Shows:

- Request
- Purchase order
- Invoice
- Delivery record
- Inventory record
- Quantity mismatch

#### Investigation Board

Shows related evidence as cards with animated connecting lines. This is used for IT theft, duplicate receipts, and suspicious vendors.

#### Slack side panel

Slack remains visible after migration, but notifications are summarized and grouped instead of covering the screen.

## 10. Desk and room layout

The player remains seated for the entire game. The primary desk is an extreme 2.50 m wide × 1.18 m deep horseshoe: a 350 mm center recess holds the input mat, while 700 mm-deep curved wings wrap manual tools around the left hand and decision controls around the right. Props should fan along those curves instead of lining up like a rectangular office desk.

### Center desk area

- Main document inspection mat
- Current receipt
- Supporting documents
- Calculator output tape
- Stamp impact area

### Left side of desk

- Incoming receipt tray
- Hardcoded policy sheet
- Calculator
- Calculator tape printer
- Desk phone
- Stress ball
- Small desk fan
- Stack of unresolved folders

### Right side of desk

- Approve tray
- Reject tray
- Investigate tray
- Approve stamp
- Reject stamp
- Fraud stamp
- Freeze card button hidden under a protective cover
- Small shredder or pneumatic rejection slot

### Rear desk area

- Main ultrawide monitor
- Secondary vertical monitor
- Keyboard
- Mouse
- Printer
- Sticky notes
- Cheap desk lamp
- Nameplate reading Head of Finance

### Employee side

Across the desk is a glass service window or open counter where employees appear.

Behind employees:

- Office corridor
- Vending machine
- Elevator doors
- A small seating area
- Space for the giraffe reveal

### Background office

Visible through glass:

- Finance employees at desks
- IT storage shelves
- Cardboard laptop boxes
- A meeting room
- Company logo
- Flickering fluorescent lights before migration
- Cleaner practical lighting after migration

## 11. Prop catalog

### Interactive desk props

- Approve stamp
- Reject stamp
- Fraud stamp
- Freeze card button
- Calculator
- Calculator tape roll
- Receipt trays
- Incoming tray
- Policy sheet
- Desk phone
- Stress ball
- Coffee mug
- Keyboard
- Mouse
- Printer
- Shredder or rejection tube
- Desk fan
- Desk lamp
- Sticky notes
- Nameplate

### Documents

- Restaurant receipts
- Hotel folios
- Airline itinerary
- Taxi receipt
- Technology invoice
- Purchase order
- Delivery confirmation
- Inventory sheet
- Vendor contract
- Social campaign report
- Corporate card statement
- Employee profile card
- AI vendor invoice
- Resale marketplace listing
- Giraffe invoice

Documents should use reusable meshes with interchangeable HTML or canvas textures.

### Office set dressing

- Office desks
- Chairs
- Filing cabinets
- Cardboard boxes
- Laptop boxes
- Monitor boxes
- Water cooler
- Vending machine
- Trash bin
- Indoor plants
- Ceiling lights
- Security camera
- Wall clock
- Company posters
- Fire extinguisher
- Elevator doors
- Glass dividers

### Comedy props

- Forklift visible in the hallway
- Stack of 600 hoodies
- Energy drink pallet
- Expensive beanbag
- Alpaca photo or small alpaca figurine
- Suspiciously large keyboard pile
- One chair delivery label attached to the beanbag
- Chief Growth Officer badge for the giraffe

## 12. Model catalog and priorities

### Priority A, required custom models

These determine whether the game feels unique.

- Finance desk with built-in interaction zones
- Three stamps
- Freeze card button with protective cover
- Calculator with tape printer
- Main printer with paper output animation
- Receipt tray set
- Employee service window
- Giraffe head and neck
- Giraffe employee badge
- Head of Finance nameplate (retain the stable contractor-nameplate integration ID)

### Priority B, required but reusable models

- Office chair
- Main monitor
- Vertical monitor
- Keyboard
- Mouse
- Desk lamp
- Coffee mug
- Desk phone
- Shredder
- Filing cabinet
- Office plant
- Laptop box
- Monitor box
- Beanbag
- Vending machine

These can come from licensed asset libraries and be restyled.

### Priority C, character models

Use four reusable upper-body characters:

- Intern
- IT director
- Marketing employee
- Executive or CEO

Character variations can be created with different hair, clothing colors, accessories, badges, and facial expressions.

Required character animations:

- Idle breathing
- Nervous glance
- Impatient finger tapping
- Pointing at receipt
- Checking phone
- Shock after rejection
- Quietly backing away
- Arguing through glass
- Looking toward vending machine after card freeze

### Priority D, background models

- Modular walls
- Glass panels
- Ceiling tiles
- Corridor pieces
- Elevator
- Meeting room furniture
- Background desks
- Shelves
- Boxes

## 13. Internal 3D model preview tool

Build a small internal route at `/model-lab`.

Purpose:

- Preview every GLB or GLTF model
- Check scale and orientation
- Test animations
- Inspect materials
- Measure triangle count
- Test lighting
- Verify browser performance
- Capture thumbnails
- Review the real desk assembly from free orbit and a fixed-eye seated first-person camera
- Trigger the Ramp introduction and giraffe reveal as explicit authored scene sequences

Required features:

- Drag and drop local GLB files
- Load model from a URL
- Model dropdown for assets already in the project
- Orbit controls
- Toggle grid
- Toggle axes
- Toggle bounding box
- Show dimensions in meters
- Show triangle count and draw calls
- Show texture memory estimate
- Animation clip dropdown
- Play, pause, restart, and scrub animation
- Lighting presets: office, neutral studio, dark, Ramp mode
- Background presets
- Wireframe toggle
- Material list
- Camera reset
- Screenshot button
- Export a small JSON manifest containing scale, rotation, position, animation names, and attribution

Recommended project asset manifest:

```json
{
  "id": "desk-calculator",
  "file": "/models/desk-calculator.glb",
  "scale": 1,
  "rotation": [0, 0, 0],
  "position": [0, 0, 0],
  "license": "CC0",
  "source": "https://example.com",
  "author": "Artist Name",
  "notes": "Retextured for finance desk"
}
```

The preview tool should flag:

- Missing textures
- Models larger than a configurable file limit
- Models with excessive triangle counts
- Models whose bounding box is extremely small or large
- Missing attribution fields for non-CC0 assets

Scene authoring must use a typed, tweakable code manifest for model placements, hero cameras, and sequence targets. The Desk Scene sidebar exposes the Ramp introduction and the giraffe entrance. The giraffe must be absent in the initial room and at the start of the animation preview. Its entrance saves the current camera, forces a pre-authored zoom toward the empty service window, runs a missing → rise → hold sequence, and holds until the user clicks the full-scene exit affordance or presses Escape; exit hides the giraffe and restores the exact prior camera. The Ramp introduction likewise exposes each migration stage as an explicit interactive advance rather than an automatic timeout. Selection/debug rings belong only in isolated model inspection, not the assembled office.

## 14. Asset sourcing workflow

Prefer custom modeling for hero props and licensed assets for generic office furniture.

Good starting points:

- Poly Haven for CC0 models, textures, and HDRIs
- Sketchfab filtered to downloadable CC0 or compatible Creative Commons models
- Kenney assets for simple game-ready props
- Quaternius for low-poly characters and props

Every downloaded model must be entered into the asset manifest with source, author, license, modifications, and final file path.

Do not download random models directly into production. Import them through the model preview tool, inspect them, optimize them, then copy the approved asset into the game directory.

## 15. Audio requirements

Audio is responsible for much of the comedy and perceived production quality.

### Required one-shot sounds

- Receipt pickup
- Receipt drop
- Paper slide
- Paper crumple
- Printer start
- Printer loop
- Printer jam
- Stamp pickup
- Approve stamp impact
- Reject stamp impact
- Fraud stamp impact
- Calculator key press
- Calculator printing
- Slack notification
- Phone ring
- Freeze card cover opening
- Freeze card button press
- Card decline beep
- Monitor power off
- Monitor power on
- Office light flicker
- Migration completion chime
- Evidence connection sound
- Correct decision chime
- Wrong decision sting
- Giraffe chew
- Giraffe badge jingle

### Ambient loops

Before Ramp:

- Fluorescent light hum
- Printer motor
- Distant office chatter
- Keyboard typing
- Phone ringing
- Air conditioning rumble
- Occasional employee cough

After Ramp:

- Soft office ambience
- Quiet keyboard sounds
- Subtle low-cortisol music loop
- Gentle UI ticks
- Almost no printer noise

### Music

Use two short adaptive loops:

- Manual mode: fast, awkward percussion with ticking and office sounds
- Ramp mode: relaxed, clean, slightly playful corporate lo-fi

During the migration, crossfade by filtering and removing the stressful percussion rather than simply switching tracks.

### Audio sourcing tool

Add an internal route at `/audio-lab`.

Features:

- Search a configured list of audio providers
- Open the source page in a new tab
- Paste an audio file URL or upload a local file
- Preview waveform
- Set trim start and end
- Normalize loudness
- Add short fade in and fade out
- Convert to OGG and MP3
- Tag by category
- Save license, author, source URL, and attribution
- Export an audio manifest
- Compare several candidates for one sound

Do not automate downloads from sites that prohibit it. The tool should support direct downloads only when the provider offers a permitted downloadable file URL or API. Otherwise it should open the source page and let a developer download it manually.

Recommended sources include Pixabay Sound Effects for royalty-free sounds and Freesound when the specific Creative Commons license is checked. Sonniss GDC audio bundles can also be useful for large licensed game audio collections. Pixabay currently describes its sound effects as royalty-free and not requiring attribution, but every downloaded asset should still retain its source metadata. 

## 16. Animation requirements

### Camera animation

Manual mode:

- Constant very small breathing motion
- Minor camera reaction when receipts hit the desk
- Increased shake as inbox pressure rises
- Fast impulse on stamp impact
- Strong shake during printer jam
- Small head turn toward Slack notifications

Ramp mode:

- Breathing motion remains but is reduced
- Horizon stabilizes
- FOV widens slightly
- Object interactions become smoother
- Camera shake is reserved for fraud actions and the ending

### Stamp animation

Sequence:

1. Player grabs stamp
2. Stamp lifts quickly
3. Stamp pauses for a few frames at the top
4. Stamp slams downward
5. Camera receives vertical and rotational impulse
6. Desk props react
7. Ink mark appears with slight overshoot
8. Receipt slides a few centimeters
9. Stamp rebounds

Each stamp needs a different feel:

- Approve: solid and satisfying
- Reject: sharper with a red flash
- Fraud: heaviest impact, alarm light, bass hit, and stronger shake

### Printer animation

- Paper feeds out with slight curl
- Printer body vibrates
- Tray fills visibly
- Jam sequence ejects several papers at bad angles
- Final overload throws one receipt toward the camera

### Ramp migration animation

- Screens power off
- Office light flickers
- Loose receipts lift slightly from desk vibration
- Old windows collapse into icons
- Relevant data cards slide into one unified workspace
- Papers on the desk snap into a neat stack
- Coffee surface becomes still
- Plant rises slightly
- Cortisol meter falls rapidly

### Freeze card animation

- Protective cover flips open
- Button rises slightly or lights up
- Player presses button
- Strong bass impact
- Screen shake
- Red pulse travels from button to monitor
- Card status changes to Frozen
- Employee in background tries to use card at vending machine
- Vending machine produces a decline beep
- Employee slowly turns toward the player

### Giraffe ending animation

- Slack message arrives
- Camera remains facing screen
- A shadow moves behind the glass
- Giraffe head slowly rises into frame
- Giraffe blinks
- Badge swings
- Giraffe chews while maintaining eye contact
- Camera performs a small involuntary double take
- Cut to title after one second of silence

## 17. Screen shake specification

Use layered procedural shake, not a single random camera offset.

Shake channels:

- Position shake
- Rotation shake
- FOV impulse
- Object reaction
- UI reaction

Presets:

### Light

Used for paper drops, Slack alerts, and calculator printing.

- Duration: 0.08 to 0.15 seconds
- Very small position movement
- Almost no rotation

### Medium

Used for approve and reject stamps.

- Duration: 0.18 to 0.28 seconds
- Strong vertical impulse
- Small roll
- Desk props wobble

### Heavy

Used for fraud stamp, freeze card, and printer jam.

- Duration: 0.35 to 0.55 seconds
- Position and rotation impulse
- Small FOV punch
- Monitor and coffee react
- Short low-frequency audio hit

### Catastrophic

Used once during the manual workflow collapse.

- Duration: 0.8 to 1.2 seconds
- Layered rumble and sharp impulses
- Printer and monitor move independently
- Papers scatter
- Slack windows jitter

Accessibility:

Add a Reduced Motion setting that lowers camera movement while preserving object animation, audio, and UI effects.

## 18. Visual style

Recommended style:

- Stylized modern office
- Slightly exaggerated proportions
- Clean low to medium poly models
- High-quality lighting and materials
- Realistic paper and plastic surfaces
- Expressive animation rather than photorealism

Manual mode palette:

- Sickly warm fluorescent lighting
- Gray and beige office materials
- Red notification accents
- Slight vignette
- More visual clutter

Ramp mode palette:

- Cleaner neutral lighting
- Better contrast
- More whitespace in UI
- Controlled accent colors
- Reduced vignette
- Less clutter

Do not turn the entire room into a Ramp advertisement. Branding should primarily live inside the software and migration moment.

## 19. Browser 3D implementation

Recommended stack:

- React
- React Three Fiber
- Drei
- Rapier for limited physics
- Zustand or a small state machine for game state
- HTML and CSS inside Drei Html for monitor interfaces
- Web Audio API or Howler for audio
- GLB and Draco or Meshopt compression for models

Use physics only where it improves the game:

- Loose receipts
- Stamp impact reactions
- Coffee wobble
- Small desk props

Use scripted animation for:

- Document snapping
- Printer output
- Migration cleanup
- Giraffe reveal
- Character reactions
- Evidence card movement

Preload only the critical opening assets before starting: the manual adaptive music loop and first paper-pickup cue. Fetch later audio when first played, and do not globally preload or invisibly mount authored GLBs. The giraffe may load on demand during the gated CEO dialogue before the service-window reveal. This keeps the deployment's cold transfer small without stuttering the opening interaction.

## 20. Production assignments

### Gameplay engineer

- Case state machine
- Receipt interactions
- Trays and decisions
- Calculator
- Timing and scoring
- Ramp migration
- Ending sequence

### 3D environment artist

- Desk
- Office shell
- Employee window
- Corridor
- Lighting setup
- Background office

### Prop artist

- Stamps
- Calculator
- Freeze button
- Printer
- Trays
- Documents
- Hero comedy props

### Character and animation artist

- Four reusable characters
- Reaction animations
- Giraffe
- Giraffe reveal animation

### UI engineer or designer

- Desktop shell
- Manual tools
- Ramp workspace
- Slack
- Travel timeline
- Vendor and inventory views
- Cortisol meter. Before Ramp it starts at 28 percent, increases on every workstation click or key event, and receives larger spikes from incoming receipts and system effects. After migration it drops to 22 percent.

### Audio owner

- Source and license sounds
- Build audio manifest
- Implement adaptive ambience
- Tune stamp and migration sound design

## 21. Must-have scope

The final demo must include:

- One polished desk environment
- Seven manual cases
- Six Ramp cases
- Three decision trays
- Three stamps
- Hardcoded policy
- Employee metadata
- Slack
- Travel view
- Vendor view
- Inventory or procurement view
- Calculator with printed tape
- Ramp migration sequence
- Low Cortisol mode
- Heavy screen shake and object reactions
- Freeze card interaction
- Giraffe ending
- Model preview tool
- Audio preview and manifest tool

## 22. Cut order

If development falls behind, cut in this order:

1. Extra manual cases beyond six
2. Extra Ramp cases beyond five
3. Complex character lip sync
4. Freeform evidence linking
5. Full spreadsheet interactions
6. Multiple endings
7. Advanced fluid simulation in coffee
8. Fully physical paper piles

Never cut:

- The manual to Ramp transformation
- The calculator
- The screen shake and stamp feel
- Slack
- Ramp Travel case
- IT inventory case
- Low Cortisol mode
- The giraffe ending

## 23. Final quality bar

The game should feel like a polished vertical slice, not a collection of fintech screens.

The player should remember five moments:

1. Discovering the first fake receipt
2. Slamming the fraud stamp
3. The printer and Slack overload
4. The sudden calm after the Ramp migration
5. The giraffe appearing outside the office

Every model, animation, sound, and UI view should support one of those moments.
