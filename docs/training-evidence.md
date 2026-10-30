# Training evidence

What the research says about building muscle, how sure it is, and what ATLAS may and may not do with it. This is the foundation for every set, rep, effort, frequency and progression figure in the app (Targets first, then Week plan).

It comes from three pieces of work by the user, October 2026: a research draft, a first check of it against the papers, and a second check (29 October 2026) that opened most of the papers the first could not and added the 2022–2026 trials the draft missed. **The latest pass wins.** Where it corrects an earlier one, the correction is noted. Reviewed 2026-10-29.

## The rule

From the user, 2026-10-29:

- **Nothing is invented.** The app's maths, algorithms and code comments rest on research.
- Where no study gives a specific number, ATLAS may choose its own, but the choice follows scientific criteria: it is consistent with the evidence, it is labelled as ATLAS's own choice, it says how it was worked out, and it is never worded as a finding.
- A number never inherits the certainty of the evidence that motivated it. "More sets help, with falling returns" is a finding; "Normal starts at 10 sets" is a decision.

`js/evidence.js` separates findings (`EVIDENCE`) from planner decisions (`PLANNER_CONFIG`). This file is the reference both are checked against.

## How to read this file

Every figure carries a tier:

| Tier | Meaning |
|---|---|
| **[A]** | Meta-analysis, systematic or umbrella review, or position stand |
| **[B]** | A peer-reviewed trial, read in full text or abstract |
| **[B-sec]** | A trial known only through another paper or a practitioner summary |
| **[C]** | Narrative review, Delphi consensus, observational study or thesis |
| **[PRE]** | Preprint, not peer reviewed |
| **[P]** | Practitioner opinion (Nippard, RP, Stronger By Science). Context only, never evidence |
| **[D]** | A design choice for ATLAS with no direct evidence behind the exact number |

How far a source was read matters too: **full text**, **abstract**, **secondary** (through someone else's summary) or **unverified** (nobody opened it). An unverified source can be mentioned but cannot carry a number in the app. Access was patchy (PubMed and PMC mostly blocked), so papers were read through Europe PMC, OpenAlex, Crossref, university repositories, author PDFs and bioRxiv; the sources table at the end gives the route.

Evidence hierarchy for product rules: position stands and meta-analyses, then replicated trials, then single trials. Practitioner content, professional routines, pump, soreness and single-person experiments are never the basis of a rule.

## Definitions

- **Hard set**: a working set taken close to failure with good technique. Warm-ups don't count.
- **Fractional hard-set equivalent (FHS)**: the unit for weekly volume. A set counts 1.0 for the muscle it mainly trains and part of a set for other muscles where measured or assumed growth justifies it. ATLAS shows these as "estimated hard-set equivalents".
- **Physical set**: a set the person actually does, whatever it credits. Time and fatigue are counted in physical sets.
- **RIR, reps in reserve**: how many more good reps the person could have done. 0 RIR is momentary failure.

## What the evidence supports

The evidence supports a *shape*: more weekly hard sets help, with diminishing returns; the step from about 8 to about 16 sets gives a small, real gain; past about 16–20 sets trained lifters gain nothing measurable; sets ending near failure help; maintenance depends on keeping load and effort, not on set count. Anything finer is ATLAS's own judgement.

### Weekly volume: diminishing returns, a real lower step, nothing shown above about 18

**The dose-response curve.**
- **Pelland et al. 2026** [A, full text via mirror]: *Sports Medicine* 56(2):481–505, DOI 10.1007/s40279-025-02344-w. 67 studies, 2,058 participants, 79.1% male, mean age 25.2; the hypertrophy *volume* analysis used 35 studies and 1,032 participants.
  - Square-root curve fits best. About **0.24% muscle size per extra fractional set** (credible interval 0.15–0.33).
  - "No clear plateau", but "still compatible with multiple functional forms", including an inverted U. Data above about **25 fractional sets** are thin.
  - Minimum effective dose for detectable growth about **4 fractional sets a week**. Smallest detectable effect **2.05%**. Efficiency tiers: 5–10 high, 11–18 intermediate.
  - Model fit is modest (marginal R² about 22%).
  - Reconstructing the curve (the check's arithmetic, not the paper's): 10 → 16 FHS adds about 1.5%, 16 → 20 about 0.8%, both below the 2.05% detectable effect.
- **ACSM Position Stand 2026** [A, full text]: DOI 10.1249/MSS.0000000000003897. 137 reviews, more than 30,000 participants. Growth is enhanced at about **≥10 sets per muscle per week**, resting on 5 positive reviews, 1 inconclusive, 1 negative. It does **not** describe diminishing returns, says experience had "minimal impact", and gives no volume-by-experience guidance.
- **Schoenfeld, Ogborn & Krieger 2017** [A, abstract]: DOI 10.1080/02640414.2016.1210197. About 0.37% per set; 5.4 / 6.6 / 9.8% for <5 / 5–9 / 10+ sets, but the category comparison was only a trend (P = 0.074), it fell to about 0.25% per set without one influential study, and most participants were untrained.
- **Krieger 2010** [A, abstract]: multiple sets gave a 40% larger effect than single sets; 2–3 vs 4–6 sets per exercise did not differ.
- **Bernárdez-Vázquez 2022** umbrella review [A, full text]: volume and frequency "could condition" growth.
- **Camargo 2025** narrative review [A/C, abstract]: a saturation point is "plausible but unconfirmed".

**The lower step (about 8 → 16) is real.**
- **Robinson 2025** [PRE, abstract]: each leg randomised to about 8 or 16 sets for 11 weeks, then repeated with legs re-randomised. 16 sets gave +1.8 cm² vastus lateralis CSA (95% HDI 0.29–3.41, 98.8% posterior probability). Strength inconclusive. No volume-specific responders. Funded by Renaissance Periodization; its two versions give 1.8 and 2.04 cm².
- **Hammarström 2020** [B, preprint abstract]: in untrained people, 3 sets per exercise beat 1 (CSA +5.2% vs +3.7%).
- **Schoenfeld et al. 2019** [B, full text]: 34 trained men, 1 / 3 / 5 sets per exercise. The gradient is strong only for 5 vs 1 set (30–45 vs 6–9 weekly sets); 3 vs 5 had weak support (BF10 0.60–2.34).
- **Brigatto et al.** [B, abstract]: online 20 December 2019, print 2022 (JSCR 36(1):22–30, DOI 10.1519/JSC.0000000000003413). 27 trained men, 9 per group, 8 weeks, 16 / 24 / 32 sets. 32 beat 16 for thickness; no 24-set difference reported.

**Above about 16–20 direct sets, trained lifters gain nothing measurable.**
- **Barsuhn 2025** [B, full text]: *J Appl Physiol*. Trained men kept habitual quad volume (about 12 sets) or added 30% (about 19) or 60% (about 25). All grew (+4.6% fat-free thigh mass, +7.0% thickness), no group effect. Squat 1RM +31.8 kg holding volume vs +15.1 kg at +60% (P = 0.008). Underpowered: 55 randomised, 29 completed.
- **Camargo 2026** [PRE, full text]: one leg +120% over habitual (32.8 sets), the other +20% (18.0). Both grew; interaction not significant (P = 0.197); a 2.7% main-effect edge sat near ultrasound error. No harm at 33 sets.
- **Enes 2024** [B-sec]: trained men from 22 weekly quad sets, some progressed to 52. Growth did not differ (P = 0.067–0.076); strength rose with volume. In the same cohort perceived strain climbed with volume while growth did not ([J Hum Kinet](https://johk.pl/?p=9616)) [B, abstract].
- **Aube 2022** [B-sec]: 12 / 18 / 24 sets, no group differences.
- **Räntilä & Ahtiainen 2026** [B, full text]: national-level athletes from 32–41 to 58–63 sets per muscle group (authors' counting). No added thickness, smaller deadlift gain (P = 0.043). Five withdrew with musculoskeletal problems; 10 of 14 non-responders were in the high-volume group.
- **Baz-Valle 2022** [A, full text]: meta-analysis of 6 studies, trained men. 12–20 vs >20 not significant for quads (p = 0.19) or biceps (p = 0.59); high favoured for triceps (p = 0.01). PEDro 4.7. "12–20" is the authors' view.
- **Heaselgrave et al.** [B, abstract]: online 2018, print 2019. 9 / 18 / 27 weekly biceps sets gave +4.3 / +9.5 / +5.4%, no significant differences. The 9-set group trained once a week, so frequency is confounded.

**Limits:** these trials are small and short (7–12 weeks), so "no significant difference" means "no large difference", not zero. They are almost all quads in men; applying them to arms and small muscles is an assumption.

**For ATLAS:** set targets are starting ranges, never thresholds, never "optimal". The best-supported move in the model is about 8 → 16. Above about 18, extra sets cost time, strain and sometimes strength with no shown gain. Focus is "a small extra return", never a percentage.

### Maintenance: cheap, but not zero

- **Bickel et al. 2011** [B, full text]: young adults held fibre size on 3 quad sets a week for 32 weeks after cutting from 27, but thigh lean mass began slipping after 16 weeks. **Older adults held fibre size on neither dose.** Participants had just finished a 16-week block, not years of training.
- **Spiering 2021** [C, abstract]: young adults kept strength and size for up to 32 weeks on 1 session a week and 1 set per exercise *if load was kept*; older adults needed about 2 sessions and 2–3 sets per exercise. Intensity is the key maintenance variable.
- **Iversen 2021** [C, full text]: strength and muscle hold for under about 3 weeks with no training.
- **Van Vossel 2024** [B, abstract]: novices trained on single-joint exercises for 10 weeks, 30 muscles measured by MRI. Trained muscles grew 2.2–17.7%; *untrained* adductor magnus fell −1.5% and soleus −2.4%. Losses were significant only in the low-energy-intake group (adductor longus −5.6%), and loss correlated with energy intake (r = 0.469).
- **Roth 2023** [B, abstract]: in a calorie deficit, trained men lost no more lean mass on about 12 than on about 20 quad sets. **Roth 2022** [A, full text] advises against routinely cutting volume while dieting.
- **Graves 1988** [B, abstract reproduction]: 1 day a week kept strength for 12 weeks.
- Pelland's 4-set minimum [A] is about growth, not maintenance. No trial tests maintenance in multi-year lifters or during a deficit.

**For ATLAS:** Maintain is a cheap floor that is never removed. Its lever is "keep the weight and the effort; fewer sets is fine". Older users need more to hold size, and so does a calorie deficit.

### Indirect sets: measured for a few pairs, assumed for the rest

- **Pelland 2026** [A]: counting indirect sets as 0.5 fit better than 0 or 1, but only those three were tested and the 0.5 was **fixed in advance** ("still an assumption"). Synergist classification "was not wholly objective". Credits were never summed across muscles.
- **Remmert et al.** [PRE]: exploratory indirect estimates about 26–39% for hypertrophy; internal numbers disagree (39, 32, 26, 16%).

Measured regional growth (almost all in untrained young adults, often 10–20 per group, but measured rather than assumed):

| Exercise | Finding | Source |
|---|---|---|
| Deep squat | Glutes +6.7%, adductors +6.2%, quads +4.9%; half squats about half as much each; **no hamstring muscle changed** | Kubo 2019 [B, full text] |
| Squat vs hip thrust | About equal glute growth; hamstrings negligible; hip thrust gave quads and adductors less | Plotkin 2023 [B, full text] |
| Leg press | Glutes +15.4%, adductor magnus +6.2%, rectus femoris only +1.1% (vs +13.2% from knee extensions) | Kinoshita/Maeo 2026, MSSE [B, full text], single trial |
| Bench press → triceps | 0.51 of extension growth; 0.55–0.57 of pec growth; long head about 0.12 (+2.1% vs +17.5% with extensions) | Brandão 2020; Ogasawara 2013 [B, full text], untrained men |
| Row → biceps | 0.47 of curls | Mannarino [B, full text] |
| Pulldown → biceps | About 1.0 of curls | Gentil 2015 [B, full text] |
| Standing vs seated calf raise | Standing: gastrocnemius +9–12%, soleus +2%. Seated: gastrocnemius +0.6–1.7% | Frontiers 2023 [B, full text] |
| Hip extension → hamstrings | Biceps femoris long head grew more than with Nordics | Bourne 2017 [B, abstract], thin |
| Direct hip-flexor work → psoas | About +3% | [LIDA record](https://lida.sport-iat.de/ta/Record/4072039?lng=en) [B] |

**No growth data at all** for delts, lats, traps, forearms, abs, obliques or serratus from compound lifts (EMG only).

### Frequency: a scheduling variable

- **Schoenfeld 2016** [A, abstract]: 10 studies, ≥2×/week favoured (ES 0.49 vs 0.30), volume not controlled. Superseded; never cite it for "frequency doesn't matter".
- **Schoenfeld, Grgic & Krieger 2019** [A, abstract]: 25 studies, no volume-equated difference.
- **Pelland 2026** [A]: growth +0.32% per extra weekly session (−0.14 to 0.82), "compatible with negligible". Frequency **does** help strength: about 3.27% per extra day.
- **Currier et al. 2023** [A]: *BJSM*, DOI 10.1136/bjsports-2023-106807. All programmes grew muscle; top-ranked was higher-load, multi-set, 2×/week (SMD 0.66, 0.47–0.85 vs no training). Its "at least twice weekly" compares programmes whose volume also differs.
- Split and full-body programmes give similar gains (Ramos-Campo 2024 [A, secondary only; identifier unconfirmed]).
- Splitting a high bench volume into two same-day sessions sped recovery in one acute trial (RQES 2023 [B, abstract]). That supports adding an exposure over stacking sets, on recovery grounds only.

**For ATLAS:** about 2 exposures a week is a convenient default, not a requirement. The Week plan may change frequency to fit the schedule without that being "suboptimal".

### Sets per session: no validated ceiling

- The only quantitative number is **Remmert et al. 2025** [PRE, v1 posted 2 April 2025]: about 11 fractional sets per session is where more stops showing a detectable benefit, with wide uncertainty.
- Barsuhn's +60% group did about 12–13 quad sets per session, Camargo's high leg about 16 (the check's arithmetic, assuming even splits), with no growth penalty.
- Nippard's 6 per session is [P]: his page calls 6 "an upper threshold per workout, not a minimum" and speculates 10–12 for back, glutes and quads; it rests on an unreviewed in-house analysis.

**For ATLAS:** a per-session number is a scheduler preference and a soft warning, never a hard block, never "safety".

### Effort: closer to failure helps; failure is not required

- **Robinson et al. 2024** [A]: DOI 10.1007/s40279-024-02069-2. Growth rose as sets ended closer to failure; strength was unrelated. Fit modest; RIR estimated from protocols. **No numeric optimum.**
- **Refalo et al. 2023** [A]: DOI 10.1007/s40279-022-01784-y. Momentary failure vs not: ES 0.12 (−0.13 to 0.37). Broader "set failure": ES 0.19 (0.00 to 0.37), not robust at r below 0.73. Mostly untrained.
- **Grgic et al. 2022** [A]: DOI 10.1016/j.jshs.2021.01.007. ES 0.22 (−0.11 to 0.55); trained subgroup 0.15 (0.03 to 0.26).
- **Refalo 2024** [B, abstract]: failure ≈ 1–2 RIR for quads (+0.181 vs +0.182 cm), more fatigue with failure. Did not test 3+ RIR.
- **Hermann et al. 2025** [B, abstract]: DOI 10.1249/MSS.0000000000003728. 42 trained, 1 set per exercise twice weekly, failure vs about 2 RIR. Both grew; failure favoured jump height ("power") without clear statistical support; strength and endurance similar. (The first check's "muscle endurance" was wrong.)
- **Lasevicius 2018** [B]: 20% 1RM gave about half the growth of 40–80%. **Lasevicius 2022** [B]: at 30% 1RM, non-failure sets gave +2.8% (not significant) vs +7.8% to failure; at 80%, failure added nothing.

**For ATLAS:** effort is a continuum. Light loads and high-rep sets need near-failure effort; heavy sets don't need failure. There is a load floor.

### RIR is approximate, for everyone

- People underpredict reps left by about 0.95 on average with huge spread; accuracy is worse far from failure and above 12 reps; **training status had no meaningful effect** (β = −0.006) (Halperin [A, preprint of the meta-analysis]).
- In trained adults, a "3 RIR" call on pushdowns at 50% 1RM missed by −4.68 reps; a "1 RIR" call at 75% missed by −0.5 (Casanova 2025 [B, full text]). Accuracy doesn't transfer between exercises.
- Accuracy is better near failure, at heavier loads and for upper-body lifts (Russo 2025 [A]); Zourdos 2016 [B, full text].
- Velocity loss as a cue: Pareja-Blanco [B], single small trial.
- Autoregulating *load* by RIR beat fixed %1RM for squat strength (Helms 2018; Graham & Cleather [B, full text]). No trial autoregulates *volume* by performance trend. Unread: a 2024 trial titled "Autoregulation Does Not Provide Additional Benefits…" ([PMC11343444](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11343444/)).

**For ATLAS:** RIR is shown as approximate. 3+ RIR is never a hypertrophy default, because a "3" is often really 5+. The first check's idea that novices are the problem is superseded: everyone stops early.

### Load and reps

- Growth is load-tolerant when sets are hard: Schoenfeld 2017 [A, abstract], DOI 10.1519/JSC.0000000000002200; Lopez 2021 [A, abstract] (28 studies, 747 adults); Carvalho 2022 [A, abstract], DOI 10.1139/apnm-2021-0515. Heavier loads give more maximal strength.
- **Schoenfeld 2015** trial [B, abstract]: DOI 10.1519/JSC.0000000000000958. n = 9 per group. Quads +9.3 vs +9.5%, elbow flexors +5.3 vs +8.6% (gap not significant), squat strength +8.8 vs +19.6% (low vs high load).
- **Morton 2016** [B]: 49 trained men, 12 weeks, 20–25RM vs 8–12RM to failure; similar growth, only bench 1RM differed.
- Rep bands are practical conventions [D]. A working envelope up to about 30 reps is acceptable with a load floor of about 30–40% 1RM (Lasevicius).

### Tempo

**Schoenfeld 2015** [A, abstract]: DOI 10.1007/s40279-015-0304-0. 8 studies, all sets to failure. Similar growth at 0.5–8 s per rep; the >10 s point rests on very few studies. No time-under-tension target.

### Range of motion and muscle length

- Lengthened partials and full range come out about equal on average: Wolf 2023 meta-analysis [A]; **Wolf 2025** [B, full text, PeerJ], trained lifters; Gschneidner [PRE]. Nippard's 2023 "5–10% better" claim is overtaken.
- Where a common exercise misses a region, the stretched position matters: overhead triceps work gave about 1.4× the growth of pushdowns (Maeo 2023 [B, abstract]); seated leg curls beat lying, +14% vs +9% (Maeo 2021 [B, abstract]); the bottom half of calf raises (Kassiano 2023 [B, abstract]); reclined leg extensions grow rectus femoris more (Larsen 2024 [PRE]).

**For ATLAS:** these become per-exercise "regions covered" notes and tie-breakers, never credit above 1.0.

### Single-joint vs multi-joint

**Rosa 2023** [A, record summary]: trivial whole-muscle differences. Unknown whether it pooled any Barbalho trials, so cite it with that caveat.

### Progression

- **Chaves et al. 2024** [B]: DOI 10.1055/a-2256-5857. 39 untrained adults, leg extension only, 10 weeks: adding load and adding reps gave similar results.
- **Barsuhn 2025** [B]: adding 30% or 60% to trained men's habitual volume gave no extra muscle and less squat strength.
- **Scarpelli 2022** [B, abstract]: 1.2× the person's logged volume beat a fixed 22 sets.
- **Damas 2019** [B, abstract]: between-person variability was about 40× between-leg variability; who grows depends mostly on the person, not the protocol.
- No trial tests adding sets after a stall.

**For ATLAS:** progress is a performance envelope (exercise + load + reps + RIR + range). Double progression is convention [P/B]. Raising volume is the last step, bounded by about +20% of the person's own baseline.

### Breaks and deloads

- **Coleman 2024** [B, full text]: a full week off gave no muscle benefit and slightly smaller strength gains. About 90 total weekly sets, trained 18–40, 22% dropout: the only whole-body anchor, a ceiling reference.
- **Bell 2023** Delphi [C, full text]: coaches prefer cutting sets and effort while keeping load; the science is limited.
- **Halonen 2024** [B, abstract]: untrained adults made up losses within about 5 weeks. **Räntilä 2025** [B, full text]: size falls faster than strength during a break; individual responses repeat across blocks (r about 0.7). **Grgic 2022** detraining [A, full text].

### Individual response

Raw growth varies hugely (2–59% CSA, Hubal 2005 [B]), but much "non-response" is measurement noise (Roberts 2018 [B]), and responses repeat within a person (Räntilä 2025). ATLAS never labels anyone a non-responder.

### Populations

- **Training status:** Pelland reports no status-specific curve; ACSM says experience had minimal impact. Status changes the starting point and ramp, never the ceiling. The trained-lifter trials, if anything, argue against "advanced needs more".
- **Age:** low volume is productive at 60+ (Radaelli [A, abstract]: 151 RCTs, 6,306 people aged 60+, low volume gave the largest effect, SMD 0.40; year given as 2024 by the repository, 2025 by the draft, not re-checked). Older adults need relatively more to *hold* size (Bickel; Spiering). **Borde 2015** [A] is about strength; for muscle size no training variable predicted the effect (SMD 0.42). Never cite Borde for hypertrophy volume.
- **Sex:** relative growth is similar (Refalo 2025 [A]). No sex modifier on set maths; sex matters for Nutrition.
- **"Natural" lifters:** trials rarely verify drug-free status. Say "healthy resistance-training populations". Almost all samples are young men.

### Recovery signals

No validated equation links sleep, soreness or pump to set changes. Performance trend at stable effort is the primary signal. Recovery data may give context, never fake precision.

## Practitioner context: Jeff Nippard

All six Nippard items in the draft exist, but the draft's metadata was wrong:

- the junk-volume video is "Junk Volume: Why You Must Avoid It For Max Muscle";
- "How To Train For Pure Muscle Growth" runs 14m31s, not about 11 minutes;
- "Science-Based Lifting Is Over (My Bad)" (video ID pi0PQZFFo4A) runs 17m13s and was first titled "Science-Based Lifters Are Under Attack";
- three videos do have chapter timestamps (the Oct 2025 low-volume video's science section starts at 11:34);
- the Minimalist article's references are headings only, without links;
- the Nuckols podcast timestamps all match.

Traced to their primaries:

- **Hold:** Krieger 2010's 40% multi-set advantage; Bickel's 27 → 3 sets; overhead extensions about 1.4× pushdowns (Maeo 2023); "35 studies" for Pelland's hypertrophy-volume subset.
- **Wrong or misleading:** Bickel's reduced phase was 32 weeks, not 16, and he omits that older adults lost size; his "64 / 84 / 100% of gains" for 1–4 / 5–9 / 10+ sets is not in Schoenfeld 2017; he counts indirect sets as full sets, which Pelland's comparison contradicts; his per-session cap rests on a paywalled unreviewed analysis; his lengthened-partials claim is overtaken by Wolf 2025. In Dec 2024 he called his own tier lists "slightly more/less effective" and said no study has directly measured back hypertrophy.

**Use in ATLAS:** exercise-selection defaults labelled "Practitioner default (J. Nippard)", cited by video ID because he renames videos; a pointer to primaries ATLAS cites directly; practitioner support for Maintain/Normal/Focus ("keep most muscles low, blast one at a time, rotate"). His set ranges (maintenance 4–8, sweet spot 8–20, Focus up to about 30 for 1–2 months) may appear only as [P]. His N=1 cut experiment never becomes a rule.

The tier lists in `js/exercises.js` (`EXERCISE_RATINGS`) match his criteria; they are practitioner opinion.

## Do not cite

- **Barbalho et al.** single-joint trials: retracted or formally flagged for data problems (untrained women, recreational bodybuilders, untrained men, trained women, "Back Squat vs. Hip Thrust in well-trained women") ([Retraction Watch](https://retractionwatch.com/2021/12/17/exercise-researcher-earns-more-retractions-as-investigations-mount/)).
- Schoenfeld 2016 for "frequency doesn't matter" (superseded).
- Nippard's 64% / 84% figures.
- Borde 2015 for hypertrophy volume.
- ACSM for diminishing returns (cite Pelland).

## Corrections to the earlier passes

| Earlier claim | Correct |
|---|---|
| Draft: experience bands (6–10 / 8–14 / 10–16) "derived from the evidence" | [D]; no status curve exists |
| Draft: advanced "16–20+ after demonstrated tolerance" | Tolerable, never shown to add growth |
| Draft: novice RIR 2–3 | No basis; status doesn't change RIR accuracy, and "3" is often 5+ |
| Draft: progression ends with "add volume if stalled" | Unproven; adding 30–60% gave nothing (Barsuhn) |
| Draft: Borde supports conservative volume for older adults | Strength only |
| Draft: ACSM cited for diminishing returns | Pelland only |
| Draft and first check: 0.5 credit "fit best" | Best of 0 / 0.5 / 1 only; assumed |
| First check: Brigatto "unverifiable", Heaselgrave "corrected to 2018" | Brigatto 2019 online / 2022 print, draft's DOI right; Heaselgrave 2018 online / 2019 print |
| First check: Hermann's outcome may be endurance | Jump height ("power"), weak |
| First check: squat → glutes 0.5, leg press → glutes 0.25 | Under-credited: deep squat glutes ≥ quads; leg press glutes 3.1× quads |
| First check: squat → hamstrings 0.25 | 0: no hamstring muscle changed |
| First check: seated calf 0.5 | 0.25: gastrocnemius barely grew |
| First check: per-set credit cap 2.0 | Dropped: a deep squat set measurably grows three groups |
| First check: novices as the RIR problem | Everyone underpredicts |
| First check: "+1 set per 2 weeks when stalled" | Compounds to +30–40% in 8 weeks, beyond what helped; cap at +20% of baseline per block |
| First check: Focus shrinks toward 10 | Toward 12 |

## Still unknown or unread

- No trial of maintenance in long-term trained lifters or during a deficit.
- No whole-body weekly ceiling; no trial of many muscles trained hard at once.
- Every regional credit comes from untrained adults; no data for delts, lats, traps, forearms, abs, obliques or serratus from compounds.
- Trained-lifter volume trials: mostly quads in men, 7–12 weeks, underpowered for 2–3% differences.
- Camargo 2026 and Robinson 2025 are preprints; the per-session ceiling rests on one preprint.
- No trial compares volume adjusted from performance against fixed volume; no trial of adding sets after a stall.
- No dose-response data for abs, obliques, serratus, iliopsoas, traps, forearms, adductors or lower back.
- Unread: the 2024 autoregulation trial (PMC11343444), Enes 2024 full text, Ramos-Campo's identifier, Ralston 2017 (identification presumed), Nippard's 2026 videos and his biceps, shoulders, glutes, hamstrings and calves tier lists, any 2025–26 Refalo failure follow-up.
- To watch: NCT07379385 (weekly set volume), NCT06825052 (deloads).

## Proposed model (second check; weekly budgets adopted)

Every number is a starting policy that adapts to the user's logs. It replaces the first check's proposal. The **weekly budgets were adopted in step 2 (2026-10-29)**; everything else below is still a proposal.

### Weekly budgets: one scale for main groups, a small labelled scale for accessories

| Priority | Main groups (FHS/week) | Accessory groups | Basis |
|---|---|---|---|
| **Maintain** | floor 3, default **4**, up to 6 | floor 2, default 2 | Bickel 3 sets [B]; Spiering 1 set/exercise once a week [C]; Pelland MED 4 [A]; floor [D] |
| **Normal** | 8–12, default **10** | default 4 (4–6) | ACSM ≥10 [A]; Pelland 5–10 and 11–18 tiers [A]; Hammarström [B]; default [D] |
| **Focus** | start **12**, default 14, ceiling **18** | default 6, ceiling 6 | 8 → 16 detectable (Robinson [PRE]); nothing extra above about 18 in trained lifters (Barsuhn, Camargo, Enes, Räntilä [B/PRE]); start = Normal × 1.2 (Scarpelli [B]); ceiling [D] |
| **Specialisation** (opt-in, later) | above 18, one muscle only | none | Tolerable, never shown to add growth; label "limited evidence, costs time and recovery" [D] |

- **Main groups (11):** chest, shoulders, triceps, upper back, lats, biceps, quads, hamstrings, glutes, calves, abs.
- **Accessory groups (5):** traps, forearms, adductors, obliques, lower back. Default priority Maintain.
- The split is [D]. The reason is *not* that small muscles need less: no dose data exist for these five, most users don't target them, and adductors and lower back get large compound credit. Abs is on the main scale because users target it, but it also has no dose data: [D].
- Per-muscle ranges for main groups would count compound overlap twice once a credit table exists, so they go.

**As built** (`weeklyTargets` in `js/evidence.js`, step 2), with the user's choices of 2026-10-29: the accessory scale is used; experience does not change the targets; with no logs, Focus aims at 14.

| | Main: floor / target | Accessory: floor / target |
|---|---|---|
| Maintain | 3 / 4 | 2 / 2 |
| Normal | 8 / 10 | 4 / 4 |
| Focus | 12 / 14 | 6 / 6 |
| Ceiling | 18 | 6 |

The accessory floors for Normal and Focus equal their targets [D]: no accessory range was proposed. When a week is short, `fitToTime` trims Normal, then Focus, to their floors; if that is not enough, Normal, then Focus, then Maintain go lower, never below the Maintain floor. The full shrink order (Normal toward 6, a Focus limit, a physical-set budget) is step 5.

### Status, age and diet

- **Status** changes start and ramp, never the ceiling [A for "no status curve", D for numbers]. With no logs, everyone starts at the defaults. With 2–3 weeks of logs: Normal = logged FHS clamped to 8–12; Focus = logged × 1.2 clamped to 12–18 (Scarpelli [B]; Barsuhn set baselines the same way). Novices get the same targets; what changes is exercise choice (stable machines first) and the effort cue.
- **Age** [D on B/C]: under 50 no change. 50–64: Normal starts at 8, ramp at most +1 FHS per 3 weeks. 65+: Normal starts at 6–8 (Radaelli). From 60: Maintain floor 4, spread over **2 exposures a week** (Spiering; Bickel).
- **Diet** [D on A/B, links to Nutrition]: in a calorie deficit, never demote a muscle from Normal to Maintain on the user's behalf (Roth 2022/2023); raise Maintain muscles to 5–6 and show "keep the weight and the effort" (Van Vossel, novices only).
- **No sex modifier** [A].

### Set-credit table

Rules [D]: credits are 1.0, 0.5, 0.25 or 0 only. A set credits each app group at most once. Credit below 1.0 covers at most half of a group's weekly target; the rest must come from sets where that group scores 1.0. **No per-set total cap.** Store as data, one row per exercise class, each with `tier`, `how` and a `regions` note. Display rounded to 0.5.

| Exercise class → group | Credit | Basis | Tier |
|---|---|---|---|
| Bench / incline press → Chest | 1.0 | Prime mover | [D] convention |
| Bench / incline press → Triceps | 0.5 | 0.51–0.57 measured; long head about 0.12 | [B], untrained; note "long head needs overhead or extension work" |
| Any press → Shoulders (front delt) | 0.5 | No growth data | [D] |
| Overhead press → Shoulders / Triceps | 1.0 / 0.5 | No overhead-specific data | [D] |
| Row → Upper back / Lats | 1.0 / 0.5 | No lat or back growth data | [D] |
| Pulldown / pull-up → Lats / Upper back | 1.0 / 0.5 | Same | [D] |
| Row or pulldown → Biceps | 0.5 | 0.47 (row) to 1.05 (pulldown); conservative end | [B], conflicting |
| Row → Shoulders (rear delt) | 0.25 | No data | [D] |
| Deep squat → Quads / Glutes / Adductors | 1.0 / 1.0 / 1.0 | Glutes 1.37×, adductors 1.27× quads (Kubo); squat ≈ hip thrust (Plotkin) | [B], untrained; note "rectus femoris needs knee extensions" |
| Half / box squat → Quads / Glutes / Adductors | 1.0 / 0.5 / 0.5 | 0.48 and 0.59 of quads (Kubo) | [B] |
| Any squat → Hamstrings | 0 | No significant change | [B] |
| Leg press → Quads / Glutes / Adductors | 1.0 / 0.5 / 0.5 | Measured glutes 3.1×, adductor magnus 1.27× quads, single trial; held at 0.5 until replicated | [B] + [D] |
| Leg press → Hamstrings | 0 | | [B] |
| Hip thrust → Glutes / Quads / Adductors | 1.0 / 0.25 / 0.25 | Glutes = squat; others less (Plotkin) | [B] glutes; [D] fractions |
| Hinge (RDL, 45° hip extension) → Hamstrings | 1.0 | Bourne 2017, thin | [B], one trial |
| Hinge → Glutes / Lower back | 0.5 / 0.5 | No data | [D] |
| Leg extension → Quads | 1.0 | Rectus femoris +13.2% | [B] |
| Leg curl → Hamstrings | 1.0 | Seated > lying (exercise note, not extra credit) | [B] |
| Standing calf raise → Calves | 1.0 | Gastrocnemius +9–12% | [B] |
| Seated calf raise → Calves | 0.25 | Gastrocnemius +0.6–1.7% | [B] |
| Leg raise / knee raise → Abs (incl. iliopsoas) | 1.0 | Psoas about +3% | [D] on [B] |
| Compounds → Abs, Obliques, Traps, Forearms | 0 | No growth data; EMG only | [D]; never claim coverage |

**As built** (`js/set-credit.js`, step 4, not yet read by the planner): the rows above backed by measured growth, [B], with the adductor decision applied (squat → Adductors 0, stored at the magnus; leg press likewise). Each row covers catalogue movements, so a row measured on one variant (back squat, standing calf raise, bench press) also covers the others; the row's `how` says so. Not in yet: the [D] rows (any press → Shoulders, overhead press, row → Upper back / Lats / rear delts, half squat, hip thrust → Quads / Adductors, hinge → Glutes / Lower back, leg raise, compounds → Abs, Obliques, Traps, Forearms) and leg press → Quads / Hamstrings. Pairs without a row keep the flat 1 / 0.5. Against the catalogue this changes 11 credits, listed in `tests/set-credit.test.js`.

With squats at 3.0 FHS per set, FHS per physical set will run well above the first check's assumed 1.25×. Compute it from generated plans; don't assume a multiplier.

### Focus cap and whole-body budget [D]

- Budget in **physical sets**: B = min(weekly working minutes ÷ 3, cap). Cap 50 for novices and users 50+, 70 default, 90 only for trained users with 4+ sessions (echoing Coleman as a ceiling reference).
- At most **3 Focus muscles** (4 when B ≥ 80).
- When the week can't fit: shrink **Normal toward 6, then Focus toward 12, never Maintain below its floor**, then show the shortfall in plain numbers. Reason: with diminishing returns the first sets on a muscle are worth the most; Normal 10 → 9 costs about a third of a percent by Pelland's slope, while Maintain 3 → 0 removes the only stimulus and the muscle can shrink (Van Vossel).
- All-Maintain week for an intermediate: 78 FHS today, 54 under this model.

### Per session [D on PRE/B]

Prefer at most **8 physical sets per group per session**, adding an exposure before stacking sets (RQES 2023 [B], recovery only). Up to 12 when days are few. Above 10 FHS for one group in one session, a soft warning: "past about 10–11 sets in one session, extra sets have not shown extra growth (preprint estimate)". Never a hard block, never "safety".

### Effort, reps and load

| Context | Default | Basis |
|---|---|---|
| Compounds, 6–12 reps (up to 15) | 1–2 RIR; barbell lifts about 2 | Refalo 2024 [B]; Robinson 2024 [A]; bands [D] |
| Machines, cables, isolation, 8–20 reps | 0–1 RIR | Halperin [A, PRE]; Russo [A]; [D] |
| Any set >15 reps or light load | 0–1 RIR | Casanova [B]; Lasevicius 2022 [B] |
| Load floor | About 30–40% 1RM; no sets above about 30 reps | Lasevicius 2018 [B] |
| Maintain and very-low-volume weeks | Keep load and effort; 0–1 RIR on safe exercises | Spiering [C]; Hermann [B], weak |
| 3+ RIR | Never a hypertrophy default | Casanova [B] |
| Calibration | Optional reps-to-failure check once per exercise on a machine; store the offset per exercise | Casanova [B]; [D] |
| Novice cue | Same targets; on compounds "stop when a rep slows clearly" (about 20–40% velocity loss) | Pareja-Blanco [B], single small trial; [D] |
| Sets per exercise | 3 default, 2–4 | Krieger 2010 [A]; Hammarström [B]; [D] |
| Tempo | Controlled; 0.5–8 s/rep; no TUT target | Schoenfeld 2015 [A] |
| Range of motion | Emphasise the stretch; full ROM ≈ lengthened partials | Wolf 2025 [B]; Wolf 2023 [A] |
| Frequency | 2 exposures at ≥8 FHS; 1 fine for Maintain under 60; Focus 2–3 | Schoenfeld 2019 [A]; Pelland [A]; [D] |

### Adaptive progression (later, once logging exists)

1. **Within an exercise:** double progression: reps up inside the range at target RIR, then the smallest load step [P; Chaves [B]].
2. **Stall:** no improvement in reps-at-load over 3 consecutive exposures. First check effort and calibration and offer a load step; only if still flat 2 weeks later, +1 FHS [D].
3. **Increase cap:** at most +20% above the user's baseline per 8-week block, never past the ceiling [D on Scarpelli, Barsuhn].
4. **Reduce:** performance down on 2 consecutive exposures at stable effort, or pain → −1 to −2 FHS or swap the exercise [D].
5. **Light week:** user-initiated only: halve sets, about +2 RIR, keep load [C: Bell]. No scheduled deloads (Coleman [B]).
6. **Return after >3 weeks off:** about 70% of previous FHS for one week, then resume [D]; the ramp is for soreness and injury risk (Halonen [B]). Don't use strength to "prove" muscle was kept (Räntilä 2025 [B]).
7. Never label anyone a non-responder.

## Decided: where the adductor magnus belongs

The second check says ATLAS "has a separate Adductors group, so the honest Hamstrings credit is 0", and that the first check's mapping of adductor magnus into Hamstrings "was wrong for this codebase". But that mapping **is** the codebase: `js/anatomy-regions.js:72` sends the painted `adductor-magnus` region to Hamstrings, by the user's anatomical decision (CLAUDE.md: its visible rear part is the "fourth hamstring"). Adductors holds the adductor longus, gracilis and pectineus.

This matters for credit. Kubo's and Kinoshita/Maeo's adductor growth includes, or is specifically, the adductor magnus. So "deep squat → Adductors 1.0" credits the app's Adductors group (longus, gracilis, pectineus) for growth that was largely measured in a muscle the app files under Hamstrings. Squat → Hamstrings 0 stays right for the true hamstrings (Kubo: no hamstring muscle changed). Before the credit table is built, the user decides whether the selection mapping, the credit mapping, or both should change. Changing the selection mapping is an anatomy decision, not a training one.

The user agreed with this reading on 2026-10-29, and with the note on trim order under "Where the code stands".

**Decision (the user, 2026-10-29):** the selection mapping stays: the adductor magnus selects Hamstrings. Its squat stimulus goes to neither broad group. It is stored at the magnus level (a `region` row in `js/set-credit.js`) and credited to neither Hamstrings nor Adductors until the app can hold sub-regions; then the magnus gets its own region and is credited directly. A 0 for squat → Adductors means too little evidence for the current group mapping, not zero activation or growth. Squat → Hamstrings 0 is a different zero: Kubo measured it. Leg press adductor magnus growth (Kinoshita/Maeo) is stored the same way.

## What the app may and may not claim

**Must:**
- call every set figure "estimated hard-set equivalents" and show the arithmetic ("6 direct + 4 from pressing = 10 estimated"), rounded to 0.5;
- show each credit row with its tier, and per-exercise "regions covered" notes ("squats don't train your hamstrings or rectus femoris"; "pressing barely trains the triceps long head");
- say Focus gives a small extra return with diminishing gains;
- say the Maintain lever is "keep the weight and the effort; fewer sets is fine";
- show the shortfall when the week can't fit;
- say targets are starting points adjusted from the user's own logs;
- show RIR as approximate;
- label practitioner defaults "Practitioner default (J. Nippard)" with the video ID;
- note that ATLAS counts sets differently from other apps (RP counts primary sets only; Fitbod's help page contradicts itself on secondary credit) ([RP](https://rpstrength.com/training-volume-landmarks-muscle-growth/), [Fitbod](https://help.fitbod.me/hc/en-us/articles/24739986755223-Weekly-Set-Targets));
- carry a medical-clearance line (cardiovascular, musculoskeletal or pregnancy-related conditions; over 40 and inactive; medication that affects exertion) and "stop on sharp pain, chest pain or dizziness".

**Must not:**
- show projected growth percentages, or promise a physique by a date;
- call any range "optimal", or any limit "safety" without a source;
- imply 0.5 is a universal physiological ratio, or that compounds cover abs, obliques, traps, forearms, delts or lats;
- claim lengthened partials beat full range;
- present tier lists as science;
- cite anything on the do-not-cite list;
- present RIR as exact;
- label a user a non-responder;
- claim sleep or soreness maps to exact set cuts.

### Wording for the screen (check against the above before use)

- **Weekly sets**: More hard sets generally support more growth, but each extra set gives a smaller return. ATLAS starts with a productive range and adjusts from there.
- **Maintain**: Enough work here to hold your progress while more training goes elsewhere. Keep the weight and the effort; fewer sets is fine.
- **Normal**: A balanced starting dose for continued growth, adjusted to your week.
- **Focus**: More of your weekly training goes here. It brings a small extra return, and each added set brings less.
- **Reps**: Muscle can grow across a wide range of reps. Moderate reps are often the most practical; heavier work builds more maximal strength.
- **Reps in reserve**: How many more good reps you could do. Most sets should end close to failure; most people stop earlier than they think.
- **Frequency**: A muscle has no magic number of training days. ATLAS spreads your weekly work so your sets stay productive.
- **Progression**: Progress can be more weight, more reps at the same weight, or better performance at the same effort. You don't need to add weight every workout.
- **Tempo**: Use controlled, repeatable reps. Slowing every rep to stretch "time under tension" hasn't been shown to build more muscle.

## Where the code stands (after step 3, 2026-10-29)

Step 3 needed no new counting: `Workout.directSets` / `assistedSets` and `WeeklyRoutine.weeklyVolume()` already counted planned sets per muscle apart from the UI. What was left became the first PR of step 4's stack:
- Each `weeklyVolume()` row also gives `direct` and `assisted` (`sets` is unchanged), for step 4's credit rules and step 7's arithmetic.
- `tests/data.test.js` checks every exercise in the catalogue: no muscle twice in its primaries, twice in its secondaries, or in both. It lists every offender. Different primaries stay valid (a squat for quads and glutes); whether both should get 1.0 is step 4's question.

Resolved in step 2:
- The per-muscle ranges are gone; muscles carry a `kind` and read one scale (`weeklyTargets`).
- Maintain is 4 on main muscles, no longer the bottom of a range; beginners' Normal now differs from Maintain (tested).
- Experience no longer raises the targets.
- The top of the scale is a ceiling, no longer labelled "safety".
- Trim order: Maintain is trimmed last and never below its floor in `fitToTime` (tested); `trimOverfullDays` keeps each muscle's floor for its priority.
- `js/estimate.js` and `js/workouts.js:52` no longer claim a threshold or "the least that usually works".
- `js/evidence.js`: the weekly-volume finding cites the published Pelland and the trained-lifter trials; a maintenance finding was added; links go to DOI or PubMed/PMC pages where they exist.

Still open:
- **No Focus limit; no physical-set budget cap** (step 5).
- **`maxSetsPerSession` 8** is a hard cap justified in a comment by research that doesn't exist (`js/workouts.js:39`).
- **Flat `secondaryCredit` 0.5** still drives the planner. The measured credits are in `js/set-credit.js` (step 4), checked against the catalogue but not read by `Workout` yet. Several credits still have no data (lower back, forearms, traps, obliques, abs from compounds; hamstrings from lunges).
- **No effort guidance, no safety line.**
- **`EXERCISE_RATINGS`** is undocumented practitioner opinion.
- **Copy:** "add sets as you adapt" (`js/targets-train.js:180`).
- **`js/evidence.js`** holds five findings this file doesn't cover yet (Singer 2024 rest, Wolf 2023 range of motion, Sousa 2024 recovery, Grgic 2019 / Hamarsland 2022 frequency, Schoenfeld 2019 counting), and some older links still point to repositories.
- **Unused:** `estimateHTML` (`js/targets.js:324`) and `PROGRESS_PHASES` (`js/estimate.js:161`), whose timeline has no source.

## Open items

Tracked, not blocking:
- **Chosen splits under-deliver (step 5).** For a split the user chooses, the time fit assumes every asked day gets a session, but recovery may place fewer (3 of 6 Lower days), so targets are lowered after the build: calves and triceps fall from 10 to 7, and the user sees it. `tests/targets-match.test.js` skips those weeks in "targets stay within 1 set of the ask", with a comment pointing here. Fix: plan a chosen split's time with the sessions it can place, then remove the skip.
- **The Maintain floor is only guaranteed in the time fit.** After the workouts are built, the routine can still lower a target to what the sessions give. The UI must not claim a guaranteed floor until step 5 makes sessions hold it.
- **Nutrition moved (decide at the Nutrition redesign).** `FULL_BODY_SETS` is now the sum of ceilings, 228 sets instead of 172, which changes "Muscle gain" coverage. A ceiling sum is a poor proxy for what someone trains.
- **Requested totals are not a plan.** Targets shows the requested sets before trimming (full body with chest on Focus: "About 132 hard sets a week"), far more than most weeks hold. Don't present it as a plan until the Focus limit and whole-body budget (step 5) exist.

- **The workout view counts on its own (step 7).** `weekSets` (`js/workout-view.js:204`) adds up each muscle's weekly sets itself, the same total a `weeklyVolume()` row gives, and the per-session lines (`:68`, `:210`) call `directSets` / `assistedSets` directly. When step 7 shows the weekly arithmetic, the view should read the row's `sets`, `direct` and `assisted` instead; the per-session split stays the workout's.

Later, after the volume work:
- `js/evidence.js` says six muscles have no tier ratings; it's eight.
- The "no exercises yet" messages are unreachable (every group has exercises) and can be deleted.

## Sources

How far each was read, and where. "EPMC" is Europe PMC.

| Source | Tier | Read | Route |
|---|---|---|---|
| Pelland et al. 2026 | A | Full text | [PDF mirror](https://www.fisiologiadelejercicio.com/wp-content/uploads/2025/12/The-Resistance-Training-Dose-Response.pdf); [EPMC record](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:41343037&resultType=core&format=json) |
| ACSM Position Stand 2026 | A | Full text | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12965823/fullTextXML) |
| Schoenfeld, Ogborn & Krieger 2017 | A | Abstract | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:27433992&format=json&resultType=core) |
| Krieger 2010 | A | Abstract | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:20300012&format=json&resultType=core) |
| Schoenfeld 2015 (tempo) | A | Abstract | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1007/s40279-015-0304-0&resultType=core&format=json) |
| Schoenfeld 2016 / 2019 (frequency) | A | Abstract | [2016](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1007/s40279-016-0543-8&resultType=core&format=json); [2019](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:30558493&resultType=core&format=json) |
| Schoenfeld 2017 (load); Lopez 2021; Carvalho 2022 | A | Abstract | [2017](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1519/JSC.0000000000002200&resultType=core&format=json); [Lopez](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:33433148&resultType=core&format=json); [Carvalho](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1139/apnm-2021-0515&resultType=core&format=json) |
| Baz-Valle 2022 | A | Full text | [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8884877/) |
| Bernárdez-Vázquez 2022 | A | Full text | [Frontiers](https://public-pages-files-2025.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2022.949021/text) |
| Camargo 2025 review | A/C | Abstract | [FAPESP](https://bv.fapesp.br/pt/publicacao/286511) |
| Robinson 2024 (RIR) | A | Read in first check | [Abertay](https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/) |
| Refalo 2023; Grgic 2022 (failure) | A | Full text / abstract | [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748); [PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=10.1016/j.jshs.2021.01.007) |
| Currier 2023 | A | Read in first check | [BJSM](https://bjsm.bmj.com/content/57/18/1211) |
| Schoenfeld 2019 (1/3/5 sets) | B | Full text (Table 1 image unread) | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6303131/fullTextXML) |
| Heaselgrave; Brigatto | B | Abstract | [OpenAlex](https://api.openalex.org/works/doi:10.1123/ijspp.2018-0427); [OpenAlex](https://api.openalex.org/works/pmid:31868813) |
| Barsuhn 2025 | B | Full text | [AUT](https://openrepository.aut.ac.nz/server/api/core/bitstreams/4f83ffc5-1aad-4dc8-92fb-1c28156b3211/content) |
| Camargo 2026 | PRE | Full text | [bioRxiv](https://www.biorxiv.org/content/10.64898/2026.02.23.707462v1) |
| Robinson 2025 | PRE | Abstract | [bioRxiv](https://www.biorxiv.org/content/10.1101/2025.07.24.666533v1) |
| Enes 2024; Enes JHK | B-sec / B | Secondary; abstract | [summary](https://www.fisiologiadelejercicio.com/efectos-de-diferentes-progresiones-en-el-aumento-de-series-semanales-en-entrenamiento-de-fuerza/); [JHK](https://johk.pl/?p=9616) |
| Aube 2022 | B-sec | Secondary | [SBS](https://www.strongerbyscience.com/?p=52401) |
| Räntilä & Ahtiainen 2026 | B | Full text | [JYX](https://jyx.jyu.fi/bitstreams/91cae5f5-7294-4d9b-b963-73609dfa1c89/download) |
| Hammarström 2020 | B | Preprint abstract | [bioRxiv](https://www.biorxiv.org/content/10.1101/666347v1.abstract) |
| Scarpelli 2022 | B | Abstract | [PubMed](https://pubmed.ncbi.nlm.nih.gov/32108724/) |
| Damas 2019 | B | Abstract | [McMaster](https://experts.mcmaster.ca/scholarly-works/1649473) |
| Van Vossel 2024 | B | Abstract | [KU](https://researchprofiles.ku.dk/en/publications/evidence-for-simultaneous-muscle-atrophy-and-hypertrophy-in-respo/) |
| Remmert et al. 2025 | PRE | Preprint page | [SportRxiv](https://sportrxiv.org/index.php/server/preprint/view/537) |
| Ramos-Campo 2024 | A (secondary) | Secondary only | [Biolayne](https://biolayne.com/reps/issue-25/full-body-vs-split-routine-wars/) |
| Split-session trial, RQES 2023 | B | Abstract | [LIDA](https://lida.sport-iat.de/ta/Record/4081322?lng=de) |
| Brandão 2020; Ogasawara 2013 | B | Full text | [Brandão](https://paulogentil.com/pdf/Varying%20the%20Order%20of%20Combinations%20of%20Single-%20and%20Multi-Joint%20Exercises%20Differentially%20Affects%20Resistance%20Training%20Adaptations.pdf); [Ogasawara](https://paulogentil.com/pdf/Comparison%20of%20muscle%20hypertrophy%20following%206-month%20of%20continuous%20and%20periodic%20strength%20training.pdf) |
| Mannarino; Gentil 2015 | B | Full text | [Mannarino](https://paulogentil.com/pdf/Single-Joint%20Exercise%20Results%20in%20Higher%20Hypertrophy%20of%20Elbow%20Flexors%20Than%20Multijoint%20Exercise.pdf); [Gentil](https://brieflands.com/articles/asjsm-21609.html) |
| Rosa 2023 | A | Record summary | [LIDA](https://lida.sport-iat.de/ta/Record/4082423?lng=en) |
| Kubo 2019 | B | Full text | [PDF](https://uniguacu.com.br/wp-content/uploads/2023/09/Artigo-Agachamento.pdf) |
| Kinoshita/Maeo 2026 | B | Full text | [PDF](https://www.fisiologiadelejercicio.com/wp-content/uploads/2026/02/hypertrophic_effects_of_single__versus_multi_joint.1002-1.pdf) |
| Plotkin 2023 | B | Full text | [Frontiers](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full) |
| Maeo 2021; Bourne 2017 | B | Abstract | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:33009197&resultType=core&format=json); [PEDro](https://search.pedro.org.au/search-results/record-detail/57401) |
| Calf trial 2023; Kassiano 2023 | B | Full text; abstract | [Frontiers](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1272106/full); [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:37015016&resultType=core&format=json) |
| Maeo 2023 (triceps) | B | Abstract | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:35819335&format=json&resultType=core) |
| Wolf 2025; Gschneidner; Larsen 2024 | B / PRE / PRE | Full text / preprint / preprint | [PeerJ](https://peerj.com/articles/18904); [SportRxiv](https://sportrxiv.org/index.php/server/preprint/download/485/1040/972); [SportRxiv](https://doi.org/10.51224/SRXIV.407) |
| Bickel 2011 | B | Full text | [PDF](https://paulogentil.com/pdf/Exercise%20Dosing%20to%20Retain%20Resistance%20Training%20Adaptations%20in%20Young%20and%20Older%20Adults.pdf) |
| Spiering 2021; Iversen 2021 | C | Abstract; full text | [PubMed](https://pubmed.ncbi.nlm.nih.gov/33629972/); [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8449772/) |
| Graves 1988 | B | Abstract reproduction | [PainScience](https://www.painscience.com/biblio/strength-maintained-for-many-weeks-after-reducing-training-frequency.html) |
| Halonen 2024; Räntilä 2025 | B | Abstract; full text | [PubMed](https://pubmed.ncbi.nlm.nih.gov/39364857/); [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12659766/) |
| Coleman 2024; Bell 2023 | B / C | Full text | [PeerJ](https://peerj.com/articles/16777); [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/) |
| Roth 2023; Roth 2022 | B / A | Abstract reproduction; full text | [Myoton](https://myoton.com/publication/resistance-training-volume-does-not-influence-lean-mass-preservation-during-energy-restriction-in-trained-males/); [Springer](https://link.springer.com/article/10.1007/s00421-022-04896-5) |
| Halperin; Russo 2025; Casanova 2025 | A (PRE) / A / B | Preprint; abstract; full text | [SportRxiv](https://sportrxiv.org/index.php/server/preprint/view/67); [Évora](https://dspace.uevora.pt/rdpc/bitstream/10174/39438/1/2025%20Russo%20et%20al.%20Factors%20influencing%20the%20accuracy%20of%20the%20repetition%20in%20reserve%20scale%20in%20resistance%20training%20%20a%20systematic%20review.pdf); [Évora](https://www.rdpc.uevora.pt/rdpc/bitstream/10174/39787/1/2025%20Casanova%20et%20al.%20Accuracy%20in%20predicting%20repetitions%20in%20reserve%20during%20resistance%20training.pdf) |
| Refalo 2024; Lasevicius 2018, 2022 | B | Abstract | [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:38393985&resultType=core&format=json); [EPMC](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=AUTH:%22Lasevicius%20T%22&resultType=core&format=json&pageSize=8) |
| Pareja-Blanco | B | Full text | [PDF](https://paulogentil.com/pdf/Effects%20of%20velocity%20loss%20during%20resistance%20training%20on%20athletic%20performance,%20strength%20gains%20and%20muscle%20adaptations.pdf) |
| Helms 2018; Graham & Cleather | B | Full text | [Frontiers](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00247/full); [St Mary's](https://research.stmarys.ac.uk/3067/3/Graham-Cleather-Autoregulation-Repetitions-in-Reserve.pdf) |
| Hermann 2025; Morton 2016; Schoenfeld 2015 load trial; Borde 2015 | B / B / B / A | Abstract | [Hermann](https://api.openalex.org/works/doi:10.1249/MSS.0000000000003728); [Morton](https://api.openalex.org/works/doi:10.1152/japplphysiol.00154.2016); [Schoenfeld](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1519/JSC.0000000000000958&resultType=core&format=json); [Borde](https://api.openalex.org/works/doi:10.1007/s40279-015-0385-9) |
| Chaves 2024 | B | Read in first check | [PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=10.1055/a-2256-5857) |
| Radaelli 2024 | A | Abstract | [ECU](https://ro.ecu.edu.au/ecuworks2022-2026/4890) |
| Refalo 2025 (sex) | A | First pass | [PeerJ](https://peerj.com/articles/19042) |
| Hubal 2005; Roberts 2018 | B | Read in first check | [Hubal](https://gwern.net/doc/exercise/2005-hubal.pdf); [Roberts](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00834/pdf) |
| Nippard (draft items, 2024 articles, tier lists) | P | Pages, transcripts, chapter lists | jeffnippard.com; [Rosetta](https://rosetta.to/u/jeffnippard/i-cut-the-number-of-sets-i-do-in-half); [Castfox](https://www.castfox.net/podcast/the-jeff-nippard-podcast-1091997/episode/45-how-important-is-failure-and-how-much-does-training-hard-matter-ft-greg-nuckols-1010950) |

## Keeping this file honest

- A source moves to verified only when someone opens it and checks the figure; note the date and how far it was read.
- A design choice stays [D] until a study supports that specific number.
- When a number in the code changes, the change cites this file or adds a source here first.
- `js/evidence.js` should match this file.
