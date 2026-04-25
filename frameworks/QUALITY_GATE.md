<!-- Source: C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\QUALITY_GATE.md · Imported: 2026-04-25 -->
# Quality Gate — Cross-Model Adversarial Review

## Prioritetsordning

**BYGG FÖRST. Granska sen.**

Ditt jobb är att leverera kod/arkitektur/filer. Quality Gate är en slutkontroll — inte uppdraget. Om du spenderar mer än 10% av din tid på granskningen har du inverterat prioriteterna.

```
90% → Bygg det du ska bygga. Testa. Iterera. Leverera.
10% → Kör Quality Gate internt innan du presenterar.
```

## Kvalitetskravet

Leverera **cutting edge** — klart över intermediate, i nivå med de bästa produktionssystem som byggs med AI-agenter idag. Lättviktigt. Varje fil motiverar sin existens.

## Quality Gate (kör internt, visa bara resultatet)

När du är klar med bygget — inte innan — gör en snabb intern granskning:

**Simulera den främsta konkurrerande modellen som granskare** (GPT → simulera Opus. Claude → simulera GPT-5). Granska ditt eget arbete längs dessa fem dimensioner:

| Dimension | Fråga |
|-----------|-------|
| **Korrekthet** | Gör det vad specen säger? Edge cases? |
| **Arkitektur** | Motiverad struktur? Onödiga lager? |
| **Kostnadseffektivitet** | Kan samma resultat nås billigare? |
| **Underhållbarhet** | Begripligt om 3 månader? |
| **Originalitet** | Genuint anpassat eller copy-paste? |

**Processen (intern, skriv inte ut varje steg):**
1. Granska ditt arbete längs alla 5 dimensioner
2. Hitta de 2-3 svagaste punkterna
3. Fixa dem om möjligt, annars dokumentera dem som medvetna trade-offs
4. Bedöm: skulle den simulerade granskaren kalla detta cutting edge?

**Om svaret är nej:** Säg det öppet. Ärlighet > fasad.

## Output (det enda användaren ser)

Bifoga detta i slutet av din leverans:

```
## Quality Gate

**Leverans:** [En mening om vad du byggde]

**Granskad mot:** [Opus 4.6 / GPT-5 / o3] (simulerad)

**Svagheter jag hittade och fixade:**
- [Vad → fix → vilken dimension]

**Kvarvarande svagheter (ärligt):**
- [Specifika punkter, medvetna trade-offs]

**Cutting edge?** [Ja/Nej/Nästan — och varför, en mening]
```
