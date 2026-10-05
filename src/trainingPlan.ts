import type {
  ExerciseCategory,
  ExerciseGuide,
  TrainingDayPlan,
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


export function createWorkoutItem(
  label: string,
  options?: {
    exerciseId?: string;
    setsReps?: string;
    notes?: string;
    category?: ExerciseCategory;
    sessionType?: "morning" | "main";
  }
): TrainingTodoItem {
  const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res: TrainingTodoItem = { id, label };
  if (options?.exerciseId) res.exerciseId = options.exerciseId;
  if (options?.setsReps) res.setsReps = options.setsReps;
  if (options?.notes) res.notes = options.notes;
  if (options?.category) res.category = options.category;
  if (options?.sessionType) res.sessionType = options.sessionType;
  return res;
}

export function createDefaultTrainingPlan(): TrainingPlanTemplate {
  return {
    id: "squad-training-plan",
    title: "Squad Training Plan",
    trainingTime: "Daily Track Session",
    goal: "Improve speed, jumping power, approach rhythm, and competition performance.",
    currentPb: "Track & Field",
    targetPeriod: "Active Season",
    dailyChecklist: [],
    days: [
      {
        id: "monday",
        name: "Monday",
        title: "Monday Session",
        focus: "Track & Field Practice",
        sections: [],
      },
      {
        id: "tuesday",
        name: "Tuesday",
        title: "Tuesday Session",
        focus: "Track & Field Practice",
        sections: [],
      },
      {
        id: "wednesday",
        name: "Wednesday",
        title: "Wednesday Session",
        focus: "Track & Field Practice",
        sections: [],
      },
      {
        id: "thursday",
        name: "Thursday",
        title: "Thursday Session",
        focus: "Rest / Active Recovery",
        sections: [],
      },
      {
        id: "friday",
        name: "Friday",
        title: "Friday Session",
        focus: "Track & Field Practice",
        sections: [],
      },
      {
        id: "saturday",
        name: "Saturday",
        title: "Saturday Session",
        focus: "Competition / Simulation",
        sections: [],
      },
      {
        id: "sunday",
        name: "Sunday",
        title: "Sunday Session",
        focus: "Rest & Recovery",
        sections: [],
      },
    ],
    phases: [],
    progressFields: ["LJ Best", "TJ Best", "30 m Sprint", "Standing LJ", "Notes"],
    personalReminders: [],
    importedSections: [],
    exerciseGuides: createExerciseGuides(),
    updatedAt: new Date().toISOString(),
  };
}

export function isLegacyDefaultPlan(plan: TrainingPlanTemplate): boolean {
  if (plan.id === "jumper-12-week-default") return true;
  return plan.days.some((d) =>
    d.sections.some((s) =>
      s.items.some((i) => i.id === "mon-jog-mobility" || i.id === "tue-warmup" || i.id === "mon-20m")
    )
  );
}

export function sanitizeTrainingPlan(plan: TrainingPlanTemplate): TrainingPlanTemplate {
  if (!isLegacyDefaultPlan(plan)) return plan;
  const clean = createDefaultTrainingPlan();
  return {
    ...clean,
    id: "squad-training-plan",
    exerciseGuides: plan.exerciseGuides ?? clean.exerciseGuides,
  };
}

export function findCurrentDayId(): string {
  const day = new Date().getDay();
  const ids = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return ids[day] ?? "monday";
}

export function getPhaseForWeek(plan: TrainingPlanTemplate, week: number): TrainingPhase {
  const phase = plan.phases.find((candidate) => candidate.weeks.includes(week));
  if (phase) return phase;
  if (plan.phases[0]) return plan.phases[0];
  return {
    id: `phase-${week}`,
    title: "General Preparation",
    weekRange: `Week ${week}`,
    weeks: [week],
    goal: "Focus on technique, speed, and consistency.",
    items: [],
    weeklyCheckFields: [],
  };
}

export const SAMPLE_WEEKLY_MARKDOWN = `# 12-Week Jumper Squad Plan: Week 1

## Monday: Approach Run-Up & Acceleration Speed
### Dynamic Warm-Up
- [ ] Jog & Dynamic Mobility Flow | 10 mins | Full range of motion for ankles & hips
- [ ] Sprint Mechanics Drills (A-Skips & B-Skips) | 3x25m | Tall posture, active pawing strike

### Technical Jumps
- [ ] 6-Stride Approach Pop-Offs into pit | 4 jumps | Fast last two steps, upright takeoff
- [ ] Full Runway Approach Checkmarks | 4 runs | Consistency on board accuracy

## Tuesday: Plyometrics & Lower Body Power
### Plyometrics & Bounds
- [ ] Depth Jumps from 30cm Box | 4x4 reps | Minimal ground contact time, reactive pop
- [ ] Alternate Leg Bounds | 4x30m | High hips, violent knee punch

### Strength & Power
- [ ] Trap Bar Deadlift | 4x5 @ 75% | Explosive hip extension
- [ ] Romanian Deadlift (RDL) | 3x8 reps | Controlled eccentric, hinge from hips

## Wednesday: Active Recovery & Mobility
### Mobility & Prehab
- [ ] Foam Rolling & Hip Mobility Flow | 20 mins | Glutes, hamstrings, hip flexors
- [ ] Core Stability Circuit: Plank & Dead Bug | 3 sets x 45s

## Thursday: Speed & Takeoff Power
### Sprint & Speed
- [ ] 30m Acceleration Sprints | 5 reps @ 95% | 3 min full recovery between reps

### Jump Mechanics
- [ ] Penultimate Step Takeoff Drill | 4 sets x 4 reps | Low-to-high center of mass

## Friday: Complex Training & Competition Prep
### Complex Training
- [ ] Jump Squats | 4x5 reps @ bodyweight | Maximum vertical explosion
- [ ] Standing Long Jump | 4 max effort attempts | Deep arm swing, full extension
- [ ] Short Approach Triple Jump | 4 attempts | Balanced hop-to-jump ratios

## Saturday: Competition / Field Testing
### Runway Testing
- [ ] Runway Approach & Takeoff Simulation | 6 attempts | Board accuracy and landing

## Sunday: Complete Rest
### Recovery
- [ ] Rest & Hydration | Full recovery
`;

function inferCategory(text: string): ExerciseCategory {
  const lower = text.toLowerCase();
  if (/plyo|bound|depth jump|drop jump|hurdle hop|pogo/i.test(lower)) return "plyometric";
  if (/sprint|speed|accel|flying|20m|30m|40m|60m|flys/i.test(lower)) return "sprint";
  if (/jump|pop-off|approach|takeoff|take-off|landing|long jump|triple jump/i.test(lower)) return "jump";
  if (/strength|squat|deadlift|rdl|clean|press|lunge|thrust|lift/i.test(lower)) return "strength";
  if (/core|plank|dead bug|bird dog|hollow|twist/i.test(lower)) return "core";
  if (/warm|mobility|jog|stretch|foam|flow|activation/i.test(lower)) return "mobility";
  if (/recover|cooldown|cool down|rest|walk|ice/i.test(lower)) return "recovery";
  return "jump";
}

function parseItemLine(
  rawLine: string,
  sectionTitle: string,
  guides: Record<string, ExerciseGuide>
): TrainingTodoItem {
  let text = rawLine.trim();

  // Strip leading checkbox or bullet: "- [ ]", "- [x]", "-", "*", "+", "•", "1."
  text = text.replace(/^(?:-\s*\[[\sxX]?\]\s*|[-*+•⁃‣]\s*|\d+[\.)]\s*)/, "").trim();

  let label = text;
  let setsReps: string | undefined;
  let notes: string | undefined;

  // 1. Check for pipe format: "Exercise Name | 4x5 reps | Focus on tall hips"
  if (text.includes("|")) {
    const parts = text.split("|").map((p) => p.trim());
    label = parts[0] || "Exercise";
    if (parts.length >= 2 && parts[1]) {
      setsReps = parts[1];
    }
    if (parts.length >= 3 && parts[2]) {
      notes = parts.slice(2).join("; ");
    }
  } else {
    // 2. Check for sets/reps in parentheses: "Depth Jumps (4x4 reps) - minimal ground contact"
    const parenMatch = text.match(/\(([^)]*(?:\d+\s*[xX]\s*\d+|\d+\s*(?:reps?|sets?|mins?|m|sec|kg|lbs?|%)|max|bodyweight)[^)]*)\)/i);
    if (parenMatch) {
      setsReps = parenMatch[1].trim();
      label = text.replace(parenMatch[0], "").replace(/\s{2,}/g, " ").trim();
    }

    // Check for colon separation: "A-Skips: 3x25m - tall posture"
    if (!setsReps && label.includes(":")) {
      const colonIdx = label.indexOf(":");
      const candidateLabel = label.slice(0, colonIdx).trim();
      const remainder = label.slice(colonIdx + 1).trim();
      if (/\d/.test(remainder)) {
        label = candidateLabel;
        if (remainder.includes(" - ")) {
          const parts = remainder.split(" - ").map((p) => p.trim());
          setsReps = parts[0];
          notes = parts.slice(1).join(" - ");
        } else {
          setsReps = remainder;
        }
      }
    }

    // Check for dash separation after label: "Trap Bar Deadlift - 4x5 @ 80% - explosive hip drive"
    if (label.includes(" - ")) {
      const parts = label.split(" - ").map((p) => p.trim());
      label = parts[0] || label;
      if (!setsReps && parts[1] && /\d/.test(parts[1])) {
        setsReps = parts[1];
        if (parts[2]) notes = parts.slice(2).join(" - ");
      } else if (!notes && parts.length > 1) {
        notes = parts.slice(1).join(" - ");
      }
    }
  }

  // Clean trailing punctuation
  label = label.replace(/[:\-–—]$/, "").trim();

  const category = inferCategory(sectionTitle + " " + label);
  const exerciseId = matchExerciseId(label, guides);
  const sessionType: "morning" | "main" = /morning|am\s*session|early\s*activation/i.test(sectionTitle + " " + rawLine) ? "morning" : "main";

  return createWorkoutItem(label, {
    setsReps,
    category,
    notes,
    exerciseId,
    sessionType,
  });
}

export function parseMarkdownChecklist(
  markdown: string,
  currentPlan: TrainingPlanTemplate
): TrainingPlanTemplate {
  const DAY_ALIASES: Record<string, string> = {
    monday: "monday",
    mon: "monday",
    tuesday: "tuesday",
    tue: "tuesday",
    tues: "tuesday",
    wednesday: "wednesday",
    wed: "wednesday",
    thursday: "thursday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    friday: "friday",
    fri: "friday",
    saturday: "saturday",
    sat: "saturday",
    sunday: "sunday",
    sun: "sunday",
  };

  const dayRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;

  let overallTitle = currentPlan.title;
  let currentDayId: string | null = null;
  let currentSectionTitle = "Dynamic Warm-Up";
  let foundAnyDays = false;
  const daysFoundInMarkdown = new Set<string>();

  // Clone days from currentPlan with an empty sections array so days in markdown start fresh
  const daysMap = new Map<string, {
    id: string;
    name: string;
    title: string;
    focus: string;
    sections: TrainingSection[];
  }>();

  for (const d of currentPlan.days) {
    daysMap.set(d.id, {
      ...d,
      sections: [],
    });
  }

  const genericSections: TrainingSection[] = [];
  let genericCurrentSection: TrainingSection | null = null;
  let sectionCounter = 0;

  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Check for top-level document title: e.g. # 12-Week Training Plan
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match && !dayRegex.test(h1Match[1])) {
      overallTitle = h1Match[1].replace(/\*\*/g, "").trim();
      continue;
    }

    // Check if heading or bold line represents a Day of the Week
    const headingMatch = line.match(/^(?:#{1,4}\s+|\*\*)(.+?)(?:\*\*|$)/);
    if (headingMatch) {
      const headingText = headingMatch[1].trim();
      const match = headingText.match(dayRegex);

      if (match) {
        const dayKey = match[1].toLowerCase();
        const targetDayId = DAY_ALIASES[dayKey];
        if (targetDayId && daysMap.has(targetDayId)) {
          currentDayId = targetDayId;
          foundAnyDays = true;
          daysFoundInMarkdown.add(targetDayId);
          currentSectionTitle = "Dynamic Warm-Up";

          const dayObj = daysMap.get(targetDayId)!;
          const sepMatch = headingText.match(/(?:[:\-–—|]\s*)(.+)$/);
          if (sepMatch && sepMatch[1].trim()) {
            dayObj.focus = sepMatch[1].trim();
            dayObj.title = headingText;
          }
          continue;
        }
      }

      // If already inside a day, this is a Section heading within that day
      if (currentDayId) {
        currentSectionTitle = headingText.replace(/[:\-–—]$/, "").trim();
        continue;
      }

      // Otherwise, generic section
      sectionCounter += 1;
      genericCurrentSection = {
        id: `imported-${sectionCounter}`,
        title: headingText,
        items: [],
      };
      genericSections.push(genericCurrentSection);
      continue;
    }

    // Check if line is a workout item (checkbox, bullet, number, or plain item with pipe)
    const isItem =
      /^(?:-\s*\[[\sxX]?\]\s*|[-*+•⁃‣]\s*|\d+[\.)]\s*)/.test(line) ||
      (Boolean(currentDayId) && line.includes("|") && !line.startsWith("#"));

    if (isItem) {
      if (currentDayId && daysMap.has(currentDayId)) {
        const dayObj = daysMap.get(currentDayId)!;
        let sec = dayObj.sections.find((s) => s.title.toLowerCase() === currentSectionTitle.toLowerCase());
        if (!sec) {
          sectionCounter += 1;
          sec = {
            id: `${currentDayId}-${sectionCounter}-${Date.now().toString(36)}`,
            title: currentSectionTitle,
            items: [],
          };
          dayObj.sections.push(sec);
        }
        const parsedItem = parseItemLine(line, currentSectionTitle, currentPlan.exerciseGuides);
        sec.items.push(parsedItem);
      } else {
        // Generic section item
        if (!genericCurrentSection) {
          sectionCounter += 1;
          genericCurrentSection = {
            id: `imported-${sectionCounter}`,
            title: "Imported Checklist",
            items: [],
          };
          genericSections.push(genericCurrentSection);
        }
        const parsedItem = parseItemLine(line, genericCurrentSection.title, currentPlan.exerciseGuides);
        genericCurrentSection.items.push(parsedItem);
      }
    }
  }

  // If days were found, construct updated days array
  const updatedDays: TrainingDayPlan[] = foundAnyDays
    ? currentPlan.days.map((originalDay) => {
        const parsed = daysMap.get(originalDay.id);
        if (parsed && daysFoundInMarkdown.has(originalDay.id)) {
          return {
            ...originalDay,
            title: parsed.title,
            focus: parsed.focus,
            sections: parsed.sections,
          };
        }
        // If not in the weekly plan markdown, reset sections so week is clean
        return {
          ...originalDay,
          sections: [],
        };
      })
    : currentPlan.days;

  return {
    ...currentPlan,
    title: overallTitle,
    days: updatedDays,
    importedSections: foundAnyDays ? currentPlan.importedSections : genericSections.filter((s) => s.items.length > 0),
    sourceMarkdown: markdown,
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
