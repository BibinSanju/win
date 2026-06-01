import type {
  ExerciseCategory,
  ExerciseGuide,
  TrainingPhase,
  TrainingPlanTemplate,
  TrainingSection,
  TrainingTodoItem,
} from "./types";

const NOW = "2026-06-01T00:00:00.000Z";
const GUIDE_LIBRARY_URL = "https://www.acefitness.org/resources/everyone/exercise-library/";
const LONG_JUMP_URL = "https://worldathletics.org/disciplines/jumps/long-jump";
const RDL_URL = "https://exrx.net/WeightExercises/OlympicLifts/RomanianDeadlift";

interface GuideSeed {
  title: string;
  category: ExerciseCategory;
  equipment: string[];
  steps: string[];
  coachingCues: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  websiteUrl: string | null;
}

const GUIDE_SEEDS: Record<string, GuideSeed> = {
  "mobility-warm-up": {
    title: "Jog + Mobility Warm-up",
    category: "mobility",
    equipment: ["Open track space"],
    steps: [
      "Jog easily for 5-8 minutes until breathing and body temperature rise.",
      "Move through ankle circles, hip circles, leg swings, and lunges.",
      "Add skips and light accelerations before faster running.",
      "Finish feeling loose, not tired.",
    ],
    coachingCues: ["Build intensity gradually.", "Move through full range without forcing it."],
    commonMistakes: ["Starting sprints cold.", "Turning the warm-up into a hard workout."],
    safetyNotes: ["Stop if sharp pain appears during mobility or jogging."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "sprint-drills": {
    title: "Sprint Drills",
    category: "sprint",
    equipment: ["Track lane or flat surface"],
    steps: [
      "Start with A-skips for posture and knee lift.",
      "Use B-skips to rehearse front-side mechanics and active ground contact.",
      "Add high knees for rhythm, then ankling for foot stiffness.",
      "Keep each drill short and crisp over 15-25 meters.",
    ],
    coachingCues: ["Tall hips.", "Dorsiflexed ankle.", "Strike down under the body."],
    commonMistakes: ["Leaning back.", "Reaching the foot too far in front.", "Rushing without rhythm."],
    safetyNotes: ["Use low volume if calves or Achilles feel tight."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "acceleration-sprint": {
    title: "Acceleration Sprint",
    category: "sprint",
    equipment: ["Track", "Stopwatch"],
    steps: [
      "Set a clear start mark and finish distance.",
      "Lean from the ankles and push hard for the first 6-8 steps.",
      "Rise gradually instead of standing up immediately.",
      "Walk back fully before the next rep.",
    ],
    coachingCues: ["Push the ground behind you.", "Big arms.", "Low heel recovery early."],
    commonMistakes: ["Popping upright too soon.", "Overstriding.", "Taking short rest."],
    safetyNotes: ["Stop if sprint mechanics break down or hamstrings tighten."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "approach-run": {
    title: "Approach Run-through",
    category: "jump",
    equipment: ["Runway", "Takeoff board or tape mark"],
    steps: [
      "Mark the start point and run the same stride count each attempt.",
      "Build speed smoothly and stay tall in the final steps.",
      "Check board contact without jumping hard.",
      "Adjust start mark only after a clear pattern appears.",
    ],
    coachingCues: ["Relaxed speed.", "Eyes forward.", "Consistent first step."],
    commonMistakes: ["Changing the start mark after every run.", "Reaching for the board."],
    safetyNotes: ["Keep these submaximal when legs are heavy."],
    websiteUrl: LONG_JUMP_URL,
  },
  "long-jump-takeoff": {
    title: "Long Jump Take-off Drill",
    category: "jump",
    equipment: ["Runway", "Pit or safe landing area"],
    steps: [
      "Use a 4-6 step approach.",
      "Hit the takeoff foot flat and active under the hip.",
      "Drive the free knee and opposite arm upward.",
      "Land safely and walk back before the next rep.",
    ],
    coachingCues: ["Tall chest.", "Fast last two steps.", "Up and out."],
    commonMistakes: ["Sinking at takeoff.", "Jumping too vertically.", "Reaching into the board."],
    safetyNotes: ["Use a pit or soft landing area for repeated contacts."],
    websiteUrl: LONG_JUMP_URL,
  },
  "standing-long-jump": {
    title: "Standing Long Jump",
    category: "jump",
    equipment: ["Measuring tape", "Flat surface"],
    steps: [
      "Stand with feet parallel behind the mark.",
      "Swing arms back while loading hips and knees.",
      "Explode forward with both feet and drive arms through.",
      "Land with both feet and measure from the back heel mark.",
    ],
    coachingCues: ["Load hips.", "Throw arms forward.", "Stick the landing."],
    commonMistakes: ["Dropping chest.", "Landing with feet staggered.", "Falling backward after landing."],
    safetyNotes: ["Use a non-slip surface and clear landing area."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "triple-jump-short-approach": {
    title: "Short Approach Triple Jump",
    category: "jump",
    equipment: ["Runway", "Pit"],
    steps: [
      "Use a short controlled approach.",
      "Keep the hop controlled and land actively.",
      "Move quickly through the step phase without collapsing.",
      "Finish with a long jump action into the pit.",
    ],
    coachingCues: ["Controlled hop.", "Tall step.", "Fast-fast-long rhythm."],
    commonMistakes: ["Making the hop too big.", "Letting the chest drop.", "Pausing between phases."],
    safetyNotes: ["Do not continue if ankle, knee, shin, or Achilles pain appears."],
    websiteUrl: "https://worldathletics.org/disciplines/jumps/triple-jump",
  },
  "alternate-bounds": {
    title: "Alternate Bounds",
    category: "plyometric",
    equipment: ["Flat grass or track"],
    steps: [
      "Start with relaxed forward momentum.",
      "Push from one leg and land on the opposite leg.",
      "Keep contacts active and hips tall.",
      "Stop the set before contacts become loud or slow.",
    ],
    coachingCues: ["Tall hips.", "Active foot.", "Cover ground without reaching."],
    commonMistakes: ["Overstriding.", "Collapsing at the knee.", "Bounding too far when tired."],
    safetyNotes: ["Keep volume low on hard surfaces."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "single-leg-hops": {
    title: "Single-leg Hops",
    category: "plyometric",
    equipment: ["Flat surface", "Measuring tape"],
    steps: [
      "Stand tall on one leg.",
      "Hop forward with an active foot and stable knee.",
      "Land balanced before the next contact.",
      "Repeat the planned distance or reps, then switch legs.",
    ],
    coachingCues: ["Knee tracks over toes.", "Quiet contact.", "Stable hips."],
    commonMistakes: ["Knee collapsing inward.", "Landing flat and noisy.", "Rushing contacts."],
    safetyNotes: ["Avoid if ankle, knee, shin, or Achilles pain is present."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "hop-step-drill": {
    title: "Hop-step Drill",
    category: "jump",
    equipment: ["Runway or grass"],
    steps: [
      "Begin with a small approach or standing start.",
      "Perform a controlled hop and active step landing.",
      "Keep the chest tall through both contacts.",
      "Reset and repeat with quality over distance.",
    ],
    coachingCues: ["Hop under control.", "Step through fast.", "Do not reach."],
    commonMistakes: ["Overjumping the hop.", "Leaning back.", "Losing rhythm."],
    safetyNotes: ["Use low volume when learning the rhythm."],
    websiteUrl: "https://worldathletics.org/disciplines/jumps/triple-jump",
  },
  "medicine-ball-throw": {
    title: "Medicine Ball Throw",
    category: "strength",
    equipment: ["Medicine ball"],
    steps: [
      "Stand balanced with the ball held securely.",
      "Load hips and trunk without rounding the back.",
      "Throw explosively using legs, hips, trunk, and arms.",
      "Reset fully before the next rep.",
    ],
    coachingCues: ["Whole-body throw.", "Brace first.", "Explode through the ground."],
    commonMistakes: ["Only using arms.", "Losing balance.", "Throwing when fatigued."],
    safetyNotes: ["Throw only into a clear area."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  squat: {
    title: "Squat",
    category: "strength",
    equipment: ["Barbell or bodyweight"],
    steps: [
      "Set feet about shoulder width and brace the trunk.",
      "Sit down between the hips while keeping the whole foot planted.",
      "Lower under control to a safe depth.",
      "Drive up by pushing the floor away.",
    ],
    coachingCues: ["Brace.", "Knees track with toes.", "Chest stays proud."],
    commonMistakes: ["Heels lifting.", "Knees caving in.", "Rushing heavy reps."],
    safetyNotes: ["Use a spotter or safety pins for heavy barbell work."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "romanian-deadlift": {
    title: "Romanian Deadlift",
    category: "strength",
    equipment: ["Barbell or dumbbells"],
    steps: [
      "Stand tall with weight in the hands and knees softly bent.",
      "Hinge at the hips while keeping the spine neutral.",
      "Lower until hamstrings are loaded without rounding.",
      "Drive hips forward to stand tall.",
    ],
    coachingCues: ["Hips back.", "Lats tight.", "Feel hamstrings load."],
    commonMistakes: ["Squatting instead of hinging.", "Rounding the back.", "Letting weight drift away."],
    safetyNotes: ["Use light load until hinge mechanics are consistent."],
    websiteUrl: RDL_URL,
  },
  "calf-raises": {
    title: "Calf Raises",
    category: "strength",
    equipment: ["Step or flat surface"],
    steps: [
      "Stand tall with feet hip-width apart.",
      "Rise onto the balls of the feet under control.",
      "Pause briefly at the top.",
      "Lower slowly to the start position.",
    ],
    coachingCues: ["Full range.", "Control down.", "Do not bounce."],
    commonMistakes: ["Rolling ankles outward.", "Partial reps.", "Using momentum."],
    safetyNotes: ["Reduce volume if Achilles soreness appears."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "hip-thrust": {
    title: "Hip Thrust",
    category: "strength",
    equipment: ["Bench", "Barbell or bodyweight"],
    steps: [
      "Set upper back on a bench and feet flat.",
      "Brace and tuck ribs down.",
      "Drive hips up until torso and thighs form a straight line.",
      "Lower under control and repeat.",
    ],
    coachingCues: ["Push through heels.", "Squeeze glutes.", "Ribs down."],
    commonMistakes: ["Overarching low back.", "Feet too far away.", "Rushing reps."],
    safetyNotes: ["Pad the hips if using a barbell."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "jump-squats": {
    title: "Jump Squats",
    category: "plyometric",
    equipment: ["Bodyweight or light load"],
    steps: [
      "Start in an athletic stance.",
      "Dip quickly into a quarter squat.",
      "Jump straight up with full extension.",
      "Land softly and reset before the next rep.",
    ],
    coachingCues: ["Fast dip.", "Soft landing.", "Quality reps only."],
    commonMistakes: ["Landing stiff.", "Letting knees collapse.", "Turning it into conditioning."],
    safetyNotes: ["Keep reps low and avoid heavy fatigue."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "glute-bridge": {
    title: "Single-leg Glute Bridge",
    category: "strength",
    equipment: ["Mat"],
    steps: [
      "Lie on your back with one foot planted and the other leg lifted.",
      "Brace the trunk and drive the planted heel down.",
      "Lift hips until the body is straight from shoulder to knee.",
      "Lower with control and repeat.",
    ],
    coachingCues: ["Heel drive.", "Level hips.", "Glute squeeze."],
    commonMistakes: ["Arching low back.", "Rotating hips.", "Pushing through toes."],
    safetyNotes: ["Stop if low back takes over the movement."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  lunges: {
    title: "Walking Lunges",
    category: "strength",
    equipment: ["Bodyweight or dumbbells"],
    steps: [
      "Step forward into a long stable stride.",
      "Lower until both knees bend under control.",
      "Push through the front foot to step into the next rep.",
      "Keep torso tall through the set.",
    ],
    coachingCues: ["Tall posture.", "Front knee tracks toes.", "Push the floor."],
    commonMistakes: ["Short choppy steps.", "Knee collapse.", "Leaning forward excessively."],
    safetyNotes: ["Use bodyweight first if balance is not stable."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "tempo-runs": {
    title: "Tempo Runs",
    category: "recovery",
    equipment: ["Track or field"],
    steps: [
      "Warm up easily before starting.",
      "Run each rep around 65-70% effort.",
      "Walk back and breathe normally before the next run.",
      "Finish feeling better, not drained.",
    ],
    coachingCues: ["Relaxed rhythm.", "Soft contacts.", "Keep it easy."],
    commonMistakes: ["Running too fast.", "Short rest.", "Forcing speed on recovery day."],
    safetyNotes: ["Skip tempo if soreness changes your stride."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "mobility-flow": {
    title: "Mobility Flow",
    category: "mobility",
    equipment: ["Mat or open space"],
    steps: [
      "Move through ankles, hips, hamstrings, and thoracic spine.",
      "Spend 30-45 seconds on each pattern.",
      "Breathe slowly and avoid forcing end range.",
      "Repeat areas that feel restricted.",
    ],
    coachingCues: ["Smooth movement.", "No pain.", "Breathe into the range."],
    commonMistakes: ["Bouncing aggressively.", "Holding breath.", "Ignoring asymmetry."],
    safetyNotes: ["Mobility should feel controlled, not sharp."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "dead-bug": {
    title: "Dead Bug",
    category: "core",
    equipment: ["Mat"],
    steps: [
      "Lie on your back with arms up and knees over hips.",
      "Brace so the low back stays gently pressed down.",
      "Reach opposite arm and leg away slowly.",
      "Return and switch sides.",
    ],
    coachingCues: ["Ribs down.", "Slow reach.", "No low-back arch."],
    commonMistakes: ["Moving too fast.", "Arching back.", "Holding breath."],
    safetyNotes: ["Shorten range if the back lifts."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "bird-dog": {
    title: "Bird Dog",
    category: "core",
    equipment: ["Mat"],
    steps: [
      "Start on hands and knees.",
      "Brace and reach opposite arm and leg long.",
      "Pause while keeping hips level.",
      "Return under control and switch sides.",
    ],
    coachingCues: ["Long line.", "Level hips.", "Slow control."],
    commonMistakes: ["Overarching.", "Rotating hips.", "Rushing reps."],
    safetyNotes: ["Keep range small if balance is difficult."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "hollow-hold": {
    title: "Hollow Hold",
    category: "core",
    equipment: ["Mat"],
    steps: [
      "Lie on your back and brace the trunk.",
      "Lift shoulders and legs while keeping low back down.",
      "Hold a shape you can control.",
      "Rest before form breaks.",
    ],
    coachingCues: ["Low back down.", "Ribs tucked.", "Shake is okay, pain is not."],
    commonMistakes: ["Arching low back.", "Holding too long.", "Neck tension."],
    safetyNotes: ["Bend knees to reduce difficulty."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "russian-twist": {
    title: "Russian Twist",
    category: "core",
    equipment: ["Mat", "Optional medicine ball"],
    steps: [
      "Sit tall with knees bent.",
      "Brace and lean back slightly.",
      "Rotate the trunk side to side under control.",
      "Keep the movement smooth and balanced.",
    ],
    coachingCues: ["Rotate ribs.", "Control the ball.", "Stay tall."],
    commonMistakes: ["Only moving arms.", "Rounding back.", "Going too fast."],
    safetyNotes: ["Avoid loaded twists if back pain is present."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  plank: {
    title: "Plank",
    category: "core",
    equipment: ["Mat"],
    steps: [
      "Set elbows under shoulders.",
      "Step feet back and brace the trunk.",
      "Hold a straight line from head to heels.",
      "Stop when hips sag or breathing is lost.",
    ],
    coachingCues: ["Ribs down.", "Squeeze glutes.", "Push elbows into floor."],
    commonMistakes: ["Hips too high.", "Low back sagging.", "Holding breath."],
    safetyNotes: ["Use shorter sets with perfect shape."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "side-plank": {
    title: "Side Plank",
    category: "core",
    equipment: ["Mat"],
    steps: [
      "Set elbow under shoulder and stack feet or knees.",
      "Lift hips until the body forms a straight line.",
      "Keep shoulders, hips, and feet aligned.",
      "Hold, breathe, then switch sides.",
    ],
    coachingCues: ["Tall hips.", "Long spine.", "Steady breathing."],
    commonMistakes: ["Shoulder shrugging.", "Hips rotating.", "Holding too long."],
    safetyNotes: ["Use knees down if shoulder or trunk control is limited."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "flying-sprint": {
    title: "Flying Sprint",
    category: "sprint",
    equipment: ["Track", "Cones"],
    steps: [
      "Use a smooth build-up zone before the timed fly zone.",
      "Enter the fly zone tall, relaxed, and fast.",
      "Sprint through the zone without straining.",
      "Decelerate gradually after the finish.",
    ],
    coachingCues: ["Tall and relaxed.", "Fast hands.", "Step down under hips."],
    commonMistakes: ["Tensing shoulders.", "Trying to accelerate inside the fly zone.", "Stopping suddenly."],
    safetyNotes: ["Only run flying sprints after a complete warm-up."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "sprint-float-sprint": {
    title: "Sprint-Float-Sprint",
    category: "sprint",
    equipment: ["Track", "Cones"],
    steps: [
      "Sprint the first zone with strong acceleration.",
      "Float by relaxing without slowing sharply.",
      "Re-accelerate in the final zone while staying smooth.",
      "Walk back fully between reps.",
    ],
    coachingCues: ["Relax the float.", "Keep posture.", "Re-accelerate smoothly."],
    commonMistakes: ["Jogging the float.", "Tensing up.", "Short rest."],
    safetyNotes: ["Stop when coordination drops."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "pogo-jumps": {
    title: "Pogo Jumps",
    category: "plyometric",
    equipment: ["Flat surface"],
    steps: [
      "Stand tall with knees mostly straight but not locked.",
      "Bounce lightly from the ankles.",
      "Keep contacts quick and quiet.",
      "Stop before stiffness turns into pounding.",
    ],
    coachingCues: ["Tall body.", "Quick ankles.", "Quiet contacts."],
    commonMistakes: ["Deep knee bend.", "Loud landings.", "Too many contacts."],
    safetyNotes: ["Avoid if Achilles or shin pain is present."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "hurdle-hops": {
    title: "Hurdle Hops / Low Cone Hops",
    category: "plyometric",
    equipment: ["Low hurdles or cones"],
    steps: [
      "Set low barriers with enough space for safe landing.",
      "Jump over each barrier with quick ground contact.",
      "Keep hips tall and land softly.",
      "Reset if rhythm or posture breaks.",
    ],
    coachingCues: ["Snap off the ground.", "Tall hips.", "Soft but quick."],
    commonMistakes: ["Barriers too high.", "Collapsing on landing.", "Chasing volume."],
    safetyNotes: ["Start with very low cones."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "split-squat-jump": {
    title: "Split Squat Jumps",
    category: "plyometric",
    equipment: ["Bodyweight"],
    steps: [
      "Start in a split stance.",
      "Dip under control.",
      "Jump and switch or reset the stance depending on the plan.",
      "Land softly with the front knee tracking toes.",
    ],
    coachingCues: ["Tall torso.", "Soft landing.", "Knee tracks toes."],
    commonMistakes: ["Landing narrow.", "Knee collapse.", "Doing reps too fast."],
    safetyNotes: ["Use regular split squats if landing control is poor."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "power-clean-or-jump-squat": {
    title: "Power Clean or Jump Squat",
    category: "strength",
    equipment: ["Barbell or bodyweight"],
    steps: [
      "Choose the version you can perform safely and technically.",
      "For power cleans, use coached technique and crisp low reps.",
      "For jump squats, use light load and full reset between reps.",
      "Stop when speed or positions fade.",
    ],
    coachingCues: ["Explosive but clean.", "Reset every rep.", "Quality before load."],
    commonMistakes: ["Heavy sloppy reps.", "Turning power work into fatigue work.", "No coach for cleans."],
    safetyNotes: ["Use jump squats if you have not been taught the clean."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "core-stability": {
    title: "Core Stability",
    category: "core",
    equipment: ["Mat"],
    steps: [
      "Pick two or three controlled trunk exercises.",
      "Brace and breathe during every rep or hold.",
      "Keep hips and ribs controlled.",
      "Stop each set before compensation appears.",
    ],
    coachingCues: ["Stable ribs.", "Level hips.", "Breathe through the brace."],
    commonMistakes: ["Chasing burn over position.", "Holding breath.", "Letting low back arch."],
    safetyNotes: ["Choose easier variations when control is lost."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "long-jump-practice": {
    title: "Long Jumps from 10-14 Strides",
    category: "jump",
    equipment: ["Runway", "Pit", "Measuring tape"],
    steps: [
      "Set a consistent approach mark.",
      "Run with controlled speed and a tall posture.",
      "Attack the board without reaching.",
      "Land safely and record distance or board accuracy.",
    ],
    coachingCues: ["Smooth speed.", "Fast penultimate step.", "Board under hips."],
    commonMistakes: ["Changing approach every attempt.", "Forcing the takeoff.", "Landing passively."],
    safetyNotes: ["Limit attempts when speed drops."],
    websiteUrl: LONG_JUMP_URL,
  },
  "landing-drills": {
    title: "Landing Drills",
    category: "jump",
    equipment: ["Sand pit"],
    steps: [
      "Start with low-intensity jumps into the pit.",
      "Practice extending legs forward before landing.",
      "Sweep arms and hips through after feet contact.",
      "Reset sand and repeat with control.",
    ],
    coachingCues: ["Heels forward.", "Hips through.", "Do not fall backward."],
    commonMistakes: ["Dropping feet early.", "Hands behind body.", "Leaning back at landing."],
    safetyNotes: ["Check the pit surface before drills."],
    websiteUrl: LONG_JUMP_URL,
  },
  "bounding-rhythm": {
    title: "Bounding Rhythm Drill",
    category: "plyometric",
    equipment: ["Track or grass"],
    steps: [
      "Use relaxed forward speed.",
      "Bound with consistent timing and posture.",
      "Keep contacts active under the hips.",
      "Stop when rhythm becomes uneven.",
    ],
    coachingCues: ["Elastic rhythm.", "Tall hips.", "Active landings."],
    commonMistakes: ["Forcing distance.", "Sitting at contact.", "Letting rhythm drift."],
    safetyNotes: ["Do not bound hard on sore shins or Achilles."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "hill-sprint": {
    title: "Hill Sprint",
    category: "sprint",
    equipment: ["Gentle hill"],
    steps: [
      "Choose a safe, gentle hill with good footing.",
      "Sprint at the planned effort, not all-out unless assigned.",
      "Drive arms and push through the ground.",
      "Walk down slowly for recovery.",
    ],
    coachingCues: ["Push, do not reach.", "Strong arms.", "Stay tall through hips."],
    commonMistakes: ["Hill too steep.", "Running downhill fast after reps.", "Overstriding."],
    safetyNotes: ["Avoid slippery or uneven hills."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "step-ups": {
    title: "Step-ups",
    category: "strength",
    equipment: ["Box or bench"],
    steps: [
      "Place the full foot on a stable box.",
      "Drive through the working leg to stand tall.",
      "Control the lower back to the floor.",
      "Repeat all reps before switching legs if assigned.",
    ],
    coachingCues: ["Whole foot on box.", "Tall finish.", "Control down."],
    commonMistakes: ["Pushing too much off the back leg.", "Knee cave.", "Box too high."],
    safetyNotes: ["Use a stable box and start low."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "nordic-hamstring": {
    title: "Nordic Hamstring Curl / Hamstring Bridge",
    category: "strength",
    equipment: ["Partner or anchor", "Mat"],
    steps: [
      "Choose Nordic curls only if you can control the descent.",
      "Keep hips extended and lower slowly.",
      "Catch yourself with hands and reset.",
      "Use hamstring bridges as the easier option.",
    ],
    coachingCues: ["Slow eccentric.", "Hips tall.", "Control beats range."],
    commonMistakes: ["Dropping quickly.", "Bending at hips.", "Too much volume."],
    safetyNotes: ["Expect soreness; start with very low reps."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "hip-mobility": {
    title: "Hip Mobility",
    category: "mobility",
    equipment: ["Mat"],
    steps: [
      "Move through hip flexor, adductor, hamstring, and glute patterns.",
      "Use slow transitions and steady breathing.",
      "Spend extra time on restricted sides.",
      "Finish with light movement to own the new range.",
    ],
    coachingCues: ["Slow and controlled.", "No forcing.", "Breathe."],
    commonMistakes: ["Pushing into pain.", "Only stretching one direction.", "Rushing positions."],
    safetyNotes: ["Avoid sharp pinching in the front of the hip."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "stretching-cooldown": {
    title: "Cooldown + Stretching",
    category: "recovery",
    equipment: ["Open space", "Optional foam roller"],
    steps: [
      "Walk or jog easily for 3-5 minutes.",
      "Breathe until heart rate settles.",
      "Stretch calves, hamstrings, hip flexors, glutes, and quads.",
      "Write quick notes while the session is fresh.",
    ],
    coachingCues: ["Downshift.", "Relaxed breathing.", "Gentle range."],
    commonMistakes: ["Skipping cooldown.", "Forcing deep stretches after hard jumping.", "Leaving notes for later."],
    safetyNotes: ["Use gentle stretching after high-intensity work."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "foam-roll-stretch": {
    title: "Stretching / Foam Rolling",
    category: "recovery",
    equipment: ["Foam roller", "Mat"],
    steps: [
      "Roll slowly over calves, quads, hamstrings, glutes, and hips.",
      "Pause on tight areas without forcing pain.",
      "Follow with light stretching.",
      "Finish feeling looser, not bruised.",
    ],
    coachingCues: ["Slow pressure.", "Breathe.", "Gentle stretch after rolling."],
    commonMistakes: ["Rolling too aggressively.", "Holding breath.", "Ignoring pain signals."],
    safetyNotes: ["Do not roll directly over joints or acute injuries."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
  "easy-jog-cycle": {
    title: "Easy Jog / Cycling",
    category: "recovery",
    equipment: ["Bike or open space"],
    steps: [
      "Start very easy for the first few minutes.",
      "Keep effort conversational.",
      "Stop before fatigue builds.",
      "Use it to increase blood flow, not fitness stress.",
    ],
    coachingCues: ["Easy pace.", "Smooth rhythm.", "Light legs."],
    commonMistakes: ["Going too hard.", "Adding extra work.", "Ignoring soreness."],
    safetyNotes: ["Choose cycling if running impact feels poor."],
    websiteUrl: GUIDE_LIBRARY_URL,
  },
};

export function createExerciseGuides(): Record<string, ExerciseGuide> {
  return Object.fromEntries(
    Object.entries(GUIDE_SEEDS).map(([id, seed]) => [
      id,
      {
        id,
        title: seed.title,
        category: seed.category,
        equipment: seed.equipment,
        steps: seed.steps,
        coachingCues: seed.coachingCues,
        commonMistakes: seed.commonMistakes,
        safetyNotes: seed.safetyNotes,
        externalLinks: {
          websiteUrl: seed.websiteUrl,
          youtubeUrl: null,
        },
        updatedAt: NOW,
      },
    ])
  );
}

function item(id: string, label: string, exerciseId?: string): TrainingTodoItem {
  return exerciseId ? { id, label, exerciseId } : { id, label };
}

export function createDefaultTrainingPlan(): TrainingPlanTemplate {
  return {
    id: "jumper-12-week-default",
    title: "Triple Jump & Long Jump - 3 Month Training Todo List",
    trainingTime: "5:00 PM - 6:30 PM",
    goal: "Improve speed, power, jumping force, approach rhythm, and competition performance.",
    currentPb: "Long Jump - 6.5 m | Triple Jump - 13 m",
    targetPeriod: "12 weeks / 3 months",
    dailyChecklist: [
      item("daily-sleep", "Slept well last night"),
      item("daily-food", "Ate proper pre-workout food"),
      item("daily-water", "Water bottle ready"),
      item("daily-shoes", "Shoes/spikes ready"),
      item("daily-warmup", "Warm-up completed"),
      item("daily-main", "Main workout completed"),
      item("daily-cooldown", "Cooldown completed"),
      item("daily-stretching", "Stretching completed"),
      item("daily-notes", "Notes written after workout"),
    ],
    days: [
      {
        id: "monday",
        name: "Monday",
        title: "Acceleration + Lower Body Power",
        focus: "Sprint start, drive phase, take-off force.",
        sections: [
          {
            id: "workout",
            title: "Workout Todo",
            items: [
              item("mon-jog-mobility", "Jog + mobility warm-up", "mobility-warm-up"),
              item("mon-sprint-drills", "A-skip, B-skip, high knees, ankling", "sprint-drills"),
              item("mon-20m", "4 x 20 m sprint", "acceleration-sprint"),
              item("mon-30m", "4 x 30 m sprint", "acceleration-sprint"),
              item("mon-40m", "3 x 40 m sprint", "acceleration-sprint"),
              item(
                "mon-takeoff-drill",
                "6 x 4-6 step long jump take-off drill",
                "long-jump-takeoff"
              ),
              item("mon-standing-lj", "4 x 2 standing long jumps", "standing-long-jump"),
              item("mon-plank", "Core plank 3 x 45 sec", "plank"),
              item("mon-cooldown", "Cooldown + stretching", "stretching-cooldown"),
            ],
          },
          {
            id: "gym-strength",
            title: "Strength Todo - Gym",
            note: "Choose gym or no-gym.",
            items: [
              item("mon-squat", "Squat 4 x 4", "squat"),
              item("mon-rdl", "Romanian deadlift 3 x 5", "romanian-deadlift"),
              item("mon-calf-gym", "Calf raises 3 x 12", "calf-raises"),
              item("mon-hip-thrust", "Hip thrust 3 x 6", "hip-thrust"),
            ],
          },
          {
            id: "no-gym-strength",
            title: "Strength Todo - No Gym",
            items: [
              item("mon-jump-squat", "Jump squats 4 x 5", "jump-squats"),
              item("mon-glute-bridge", "Single-leg glute bridge 3 x 8 each leg", "glute-bridge"),
              item("mon-lunges", "Walking lunges 3 x 10 each leg", "lunges"),
              item("mon-calf-nogym", "Calf raises 4 x 15", "calf-raises"),
            ],
          },
        ],
      },
      {
        id: "tuesday",
        name: "Tuesday",
        title: "Triple Jump Technique + Bounding",
        focus: "Hop-step-jump rhythm, elastic power, active landings.",
        sections: [
          {
            id: "workout",
            title: "Workout Todo",
            items: [
              item("tue-warmup-drills", "Warm-up + sprint drills", "sprint-drills"),
              item("tue-approach", "6 approach run-throughs", "approach-run"),
              item("tue-bounds", "4 x 30 m alternate bounds", "alternate-bounds"),
              item("tue-hops", "3 x 15 m single-leg hops each leg", "single-leg-hops"),
              item("tue-hop-step", "5 hop-step drills", "hop-step-drill"),
              item("tue-short-tj", "4-6 short approach triple jumps", "triple-jump-short-approach"),
              item(
                "tue-med-ball",
                "4 x 5 medicine ball throws / explosive push",
                "medicine-ball-throw"
              ),
              item("tue-side-plank", "Side plank 3 x 30 sec each side", "side-plank"),
              item("tue-cooldown", "Cooldown + stretching", "stretching-cooldown"),
            ],
          },
          {
            id: "technique-notes",
            title: "Technique Notes",
            items: [
              item("tue-hop-controlled", "First hop is controlled, not too big"),
              item("tue-chest-tall", "Chest stays tall"),
              item("tue-step-active", "Step phase stays active"),
              item("tue-rhythm", "Fast-fast-long rhythm maintained"),
            ],
          },
        ],
      },
      {
        id: "wednesday",
        name: "Wednesday",
        title: "Recovery + Tempo + Mobility",
        focus: "Recovery, flexibility, light fitness.",
        sections: [
          {
            id: "workout",
            title: "Workout Todo",
            items: [
              item("wed-easy-warmup", "Easy warm-up", "mobility-warm-up"),
              item("wed-tempo", "6-8 x 100 m tempo runs at 65-70%", "tempo-runs"),
              item("wed-walkback", "Walk-back recovery after each run", "tempo-runs"),
              item("wed-mobility", "Mobility flow 15 min", "mobility-flow"),
              item("wed-dead-bug", "Dead bug 3 x 12", "dead-bug"),
              item("wed-bird-dog", "Bird dog 3 x 12", "bird-dog"),
              item("wed-hollow", "Hollow hold 3 x 20 sec", "hollow-hold"),
              item("wed-russian", "Russian twist 3 x 20", "russian-twist"),
              item("wed-foam", "Stretching / foam rolling 10 min", "foam-roll-stretch"),
            ],
          },
        ],
      },
      {
        id: "thursday",
        name: "Thursday",
        title: "Max Speed + Explosive Plyometrics",
        focus: "Top speed, fast ground contact, elastic power.",
        sections: [
          {
            id: "workout",
            title: "Workout Todo",
            items: [
              item("thu-warmup-drills", "Warm-up + sprint drills", "sprint-drills"),
              item("thu-flying", "5 flying 20 m sprints", "flying-sprint"),
              item("thu-60m", "4 x 60 m sprint at 90-95%", "acceleration-sprint"),
              item("thu-sfs", "3 x 60 m sprint-float-sprint", "sprint-float-sprint"),
              item("thu-pogo", "Pogo jumps 3 x 20", "pogo-jumps"),
              item("thu-hurdle", "Hurdle hops / low cone hops 4 x 5", "hurdle-hops"),
              item("thu-split-squat", "Split squat jumps 3 x 5 each leg", "split-squat-jump"),
              item("thu-cooldown", "Cooldown + stretching", "stretching-cooldown"),
            ],
          },
          {
            id: "strength",
            title: "Strength Todo",
            items: [
              item(
                "thu-power-clean",
                "Power clean 4 x 3 OR jump squats 4 x 4",
                "power-clean-or-jump-squat"
              ),
              item("thu-core-stability", "Core stability 10 min", "core-stability"),
            ],
          },
        ],
      },
      {
        id: "friday",
        name: "Friday",
        title: "Long Jump + Triple Jump Event Day",
        focus: "Approach rhythm, board accuracy, event practice.",
        sections: [
          {
            id: "workout",
            title: "Workout Todo",
            items: [
              item("fri-warmup-drills", "Warm-up + sprint drills", "sprint-drills"),
              item("fri-lj-approach", "6 long jump approach check runs", "approach-run"),
              item("fri-lj-jumps", "4-6 long jumps from 10-14 strides", "long-jump-practice"),
              item("fri-short-tj", "3-4 short approach triple jumps", "triple-jump-short-approach"),
              item("fri-landing", "5 landing drills in pit", "landing-drills"),
              item("fri-bound-rhythm", "3 x 30 m bounding rhythm drill", "bounding-rhythm"),
              item("fri-core-mobility", "Core + mobility 10 min", "core-stability"),
              item("fri-cooldown", "Cooldown + stretching", "stretching-cooldown"),
            ],
          },
          {
            id: "event-focus",
            title: "Event Focus",
            items: [
              item("fri-focus-selected", "Week focus selected: Long Jump / Triple Jump"),
              item("fri-board", "Board accuracy checked"),
              item("fri-best-jump", "Best jump measured"),
              item("fri-video", "Video recorded"),
              item("fri-mistakes", "Mistakes noted"),
            ],
          },
        ],
      },
      {
        id: "saturday",
        name: "Saturday",
        title: "Light Strength + Flexibility",
        focus: "Injury prevention, weak points, mobility.",
        sections: [
          {
            id: "workout",
            title: "Workout Todo",
            items: [
              item("sat-easy", "Easy jog / cycling 10 min", "easy-jog-cycle"),
              item("sat-hill", "5 x 40 m hill sprint at 75-80%", "hill-sprint"),
              item("sat-stepups", "Step-ups 3 x 8 each leg", "step-ups"),
              item(
                "sat-nordic",
                "Nordic hamstring curl / hamstring bridge 3 x 5",
                "nordic-hamstring"
              ),
              item("sat-calf", "Calf raises 4 x 15", "calf-raises"),
              item("sat-hip-mobility", "Hip mobility 20 min", "hip-mobility"),
              item("sat-stretch", "Full-body stretching", "stretching-cooldown"),
            ],
          },
        ],
      },
      {
        id: "sunday",
        name: "Sunday",
        title: "Full Rest",
        focus: "Recover and prepare for the next week.",
        sections: [
          {
            id: "recovery",
            title: "Recovery Todo",
            items: [
              item("sun-no-running", "No hard running"),
              item("sun-no-jumping", "No jumping"),
              item("sun-sleep", "Sleep well"),
              item("sun-hydrate", "Hydrate properly"),
              item("sun-walk", "Light walking only if needed", "easy-jog-cycle"),
              item("sun-prepare", "Prepare for next week"),
            ],
          },
        ],
      },
    ],
    phases: [
      {
        id: "foundation",
        title: "Foundation + Technique",
        weekRange: "Weeks 1-4",
        weeks: [1, 2, 3, 4],
        goal: "Build clean technique, sprint mechanics, and basic strength.",
        items: [
          item("phase-found-short-approach", "Short approach jumps only", "long-jump-practice"),
          item("phase-found-plyos", "Low to medium plyometrics", "pogo-jumps"),
          item("phase-found-sprint", "Focus on sprint form", "sprint-drills"),
          item("phase-found-strength", "Build strength safely", "squat"),
          item("phase-found-video", "Record videos weekly"),
        ],
        weeklyCheckFields: [
          "Long Jump best",
          "Triple Jump best",
          "30 m sprint time",
          "Standing long jump",
          "Notes",
        ],
      },
      {
        id: "speed-power",
        title: "Speed + Power Phase",
        weekRange: "Weeks 5-8",
        weeks: [5, 6, 7, 8],
        goal: "Increase approach speed, take-off force, and elastic power.",
        items: [
          item("phase-speed-flying", "Add flying sprints", "flying-sprint"),
          item("phase-speed-strides", "Use 10-16 stride jumps", "long-jump-practice"),
          item("phase-speed-explosive", "Increase explosive work", "jump-squats"),
          item("phase-speed-board", "Practice board accuracy", "approach-run"),
          item("phase-speed-measure", "Measure jumps every Friday"),
        ],
        weeklyCheckFields: [
          "Long Jump best",
          "Triple Jump best",
          "30 m sprint time",
          "Flying 20 m time",
          "5 bounds distance",
          "Notes",
        ],
      },
      {
        id: "competition",
        title: "Competition Simulation",
        weekRange: "Weeks 9-11",
        weeks: [9, 10, 11],
        goal: "Perform under competition style pressure.",
        items: [
          item("phase-comp-warmup", "Full warm-up", "mobility-warm-up"),
          item("phase-comp-lj", "3 long jump attempts", "long-jump-practice"),
          item("phase-comp-tj", "3 triple jump attempts", "triple-jump-short-approach"),
          item("phase-comp-measure", "Measure all jumps"),
          item("phase-comp-fouls", "Track fouls"),
          item("phase-comp-video", "Review video"),
          item("phase-comp-stop", "Stop if speed drops badly"),
        ],
        weeklyCheckFields: [
          "Best LJ attempt",
          "Best TJ attempt",
          "Fouls",
          "Board accuracy",
          "Notes",
        ],
      },
      {
        id: "taper",
        title: "Taper Week",
        weekRange: "Week 12",
        weeks: [12],
        goal: "Fresh legs, sharp speed, no fatigue.",
        items: [
          item("phase-taper-volume", "Reduce training volume"),
          item("phase-taper-speed", "Keep sprint speed sharp", "flying-sprint"),
          item("phase-taper-heavy", "No heavy lifting"),
          item("phase-taper-bounding", "No high-volume bounding"),
          item("phase-taper-sleep", "Sleep properly"),
          item("phase-taper-kit", "Competition kit ready"),
        ],
        weeklyCheckFields: [
          "Long Jump target",
          "Triple Jump target",
          "Main technical cue",
          "Competition date",
        ],
      },
    ],
    progressFields: ["LJ Best", "TJ Best", "30 m Sprint", "Flying 20 m", "Standing LJ", "Notes"],
    personalReminders: [
      item("reminder-quality", "Quality is more important than quantity"),
      item("reminder-heavy-legs", "Do not sprint/jump hard if legs are heavy"),
      item("reminder-pain", "Pain in shin, knee, ankle, or Achilles means reduce bounding"),
      item("reminder-board", "Board accuracy matters as much as raw speed"),
      item("reminder-hop", "Do not make triple jump first hop too big"),
      item("reminder-recovery", "Recovery is also training"),
      item("reminder-video", "Record and review videos weekly"),
    ],
    importedSections: [],
    exerciseGuides: createExerciseGuides(),
    updatedAt: NOW,
  };
}

export function findCurrentDayId(): string {
  const day = new Date().getDay();
  const ids = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return ids[day] ?? "monday";
}

export function getPhaseForWeek(plan: TrainingPlanTemplate, week: number): TrainingPhase {
  const phase = plan.phases.find((candidate) => candidate.weeks.includes(week));
  const firstPhase = plan.phases[0];
  if (!phase && !firstPhase) {
    throw new Error("Training plan has no phases.");
  }
  return phase ?? firstPhase;
}

export function parseMarkdownChecklist(
  markdown: string,
  currentPlan: TrainingPlanTemplate
): TrainingPlanTemplate {
  const importedSections: TrainingSection[] = [];
  let currentSection: TrainingSection | null = null;
  let sectionIndex = 0;
  let itemIndex = 0;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const checkbox = line.match(/^-\s+\[\s?\]\s+(.+)$/);

    if (heading) {
      const title = heading[2]?.replace(/\*\*/g, "").trim() ?? "Imported section";
      sectionIndex += 1;
      currentSection = {
        id: `imported-${sectionIndex}`,
        title,
        items: [],
      };
      importedSections.push(currentSection);
      continue;
    }

    if (!checkbox) continue;

    if (!currentSection) {
      sectionIndex += 1;
      currentSection = {
        id: `imported-${sectionIndex}`,
        title: "Imported checklist",
        items: [],
      };
      importedSections.push(currentSection);
    }

    const label = checkbox[1]?.trim() ?? "Imported item";
    itemIndex += 1;
    currentSection.items.push(
      item(`imported-${itemIndex}`, label, matchExerciseId(label, currentPlan.exerciseGuides))
    );
  }

  return {
    ...currentPlan,
    title: "Imported Training Plan",
    sourceMarkdown: markdown,
    importedSections: importedSections.filter((section) => section.items.length > 0),
    updatedAt: new Date().toISOString(),
  };
}

export function matchExerciseId(
  label: string,
  guides: Record<string, ExerciseGuide>
): string | undefined {
  const normalized = label.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/a-skip|b-skip|high knees|ankling|sprint drills|sprint form/, "sprint-drills"],
    [/flying\s*20|flying sprint/, "flying-sprint"],
    [/sprint-float-sprint/, "sprint-float-sprint"],
    [/hill sprint/, "hill-sprint"],
    [/\b(20|30|40|60)\s*m sprint|acceleration/, "acceleration-sprint"],
    [/approach run|approach check/, "approach-run"],
    [/take-off drill|takeoff drill/, "long-jump-takeoff"],
    [/standing long jump/, "standing-long-jump"],
    [/short approach triple|triple jump attempts/, "triple-jump-short-approach"],
    [/alternate bounds/, "alternate-bounds"],
    [/single-leg hops|single leg hops/, "single-leg-hops"],
    [/hop-step/, "hop-step-drill"],
    [/medicine ball/, "medicine-ball-throw"],
    [/squat 4 x 4$/, "squat"],
    [/romanian deadlift|rdl/, "romanian-deadlift"],
    [/calf raises/, "calf-raises"],
    [/hip thrust/, "hip-thrust"],
    [/jump squats/, "jump-squats"],
    [/glute bridge/, "glute-bridge"],
    [/lunges/, "lunges"],
    [/tempo runs/, "tempo-runs"],
    [/mobility flow/, "mobility-flow"],
    [/dead bug/, "dead-bug"],
    [/bird dog/, "bird-dog"],
    [/hollow hold/, "hollow-hold"],
    [/russian twist/, "russian-twist"],
    [/side plank/, "side-plank"],
    [/\bplank\b/, "plank"],
    [/pogo jumps/, "pogo-jumps"],
    [/hurdle hops|cone hops/, "hurdle-hops"],
    [/split squat jumps/, "split-squat-jump"],
    [/power clean/, "power-clean-or-jump-squat"],
    [/core stability|core \+ mobility/, "core-stability"],
    [/long jumps from|long jump attempts|short approach jumps|10-16 stride/, "long-jump-practice"],
    [/landing drills/, "landing-drills"],
    [/bounding rhythm|5 bounds/, "bounding-rhythm"],
    [/step-ups|step ups/, "step-ups"],
    [/nordic hamstring|hamstring bridge/, "nordic-hamstring"],
    [/hip mobility/, "hip-mobility"],
    [/stretching|cooldown/, "stretching-cooldown"],
    [/foam rolling/, "foam-roll-stretch"],
    [/easy jog|cycling|light walking/, "easy-jog-cycle"],
    [/warm-up|warmup/, "mobility-warm-up"],
  ];

  for (const [pattern, id] of candidates) {
    if (pattern.test(normalized) && guides[id]) return id;
  }

  return undefined;
}

export function countPlanItems(plan: TrainingPlanTemplate): number {
  const dayItems = plan.days.flatMap((day) => day.sections.flatMap((section) => section.items));
  const phaseItems = plan.phases.flatMap((phase) => phase.items);
  const importedItems = plan.importedSections.flatMap((section) => section.items);
  return (
    plan.dailyChecklist.length +
    dayItems.length +
    phaseItems.length +
    plan.personalReminders.length +
    importedItems.length
  );
}
