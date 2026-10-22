# Cambridge TCG: paste-ready marketplace texts (ASSETS M1, M3, M4, M6)

Written 2026-10-22 by Claude Code agents for Yu. It is a draft and an agents' proposal, not Yu's
decision. Nothing here is posted; pasting is Yu's hand.

**Where this file lives.** It is a dated draft, and it stays here until Yu approves the texts. What
happens to them after that is an agents' proposal, set out once in RESEARCH §7.6.

This is research and drafting, not legal or tax advice. A solicitor's glance at the returns,
withdrawal, terms and privacy texts is advisable (ASSETS M4), and the accountant settles every VAT
point.

Evidence: RESEARCH §7.6 and three notes from 2026-10-22 in this folder:
[ebay-account.md](ebay-account.md), [cardmarket-account.md](cardmarket-account.md) and
[vat.md](vat.md).

**How to read this file.** Inside the grey paste blocks, square brackets mark placeholders and
nothing else. Outside them, these evidence labels are used:
- [V] read on a primary source on 2026-10-22 by one researcher; not yet fact-checked by a second
  session (RESEARCH's [V, 2026-10-22]);
- [O] seen on the account's own public page on 2026-10-22;
- [S] secondary, including our own earlier notes;
- [I] inference;
- [U] unknown.

**Terms.** CCR means the Consumer Contracts Regulations 2013. G1–G4 are the gates in README §5.

## What was and wasn't observed

Yu, 2026-10-22: "eBay: cambridgetcg cardmarket: cambridgetcg 😂 yes VAT registered."

- **eBay `cambridgetcg` was observed** [O]: https://www.ebay.co.uk/usr/cambridgetcg and one listing,
  https://www.ebay.co.uk/itm/820050875670 (ebay-account.md). What is already in place:
  - About text: "Minty and authentic cards imported from Japan :)".
  - An avatar reading "Cambridge TCG" (a blue mark).
  - Real photos of each card, "Location: United Kingdom", "100% positive Feedback (340)" and "950
    items sold".
  - The listing read says "**Registered as a private seller**". It has no business-seller panel,
    and its returns line reads "**No returns accepted.**"
- **How eBay was observed.** A script drove a headless browser, logged out, with no clicks, 19:38–19:44
  UTC. The first load in each fresh browser context got a 403 bot wall. The run then used new
  contexts and warm-up loads until pages loaded, and it stopped at a captcha. eBay's User Agreement
  bars "automated means to access our Services for any purpose, except with the prior express
  permission of eBay" [V, help 4259]. Agents won't repeat this. Further checks of either account
  should be Yu's own logged-in look: Yu can paste or screenshot what the profile shows.
- **Cardmarket `cambridgetcg` was not observed** [U]. Its profile page answered with a Cloudflare bot
  check (HTTP 403, "Just a moment..."), which we did not try to pass. None of the archives or search
  indexes that answered holds a copy (cardmarket-account.md). So every Cardmarket text below is
  written blind.

**Check every block against the live profile before pasting.** On Cardmarket, look first at
whatever About, terms, privacy or withdrawal text already exists, and replace or merge rather than
add a second copy.

**One thing comes before the texts.** M1 and M4 are business texts. They fit an account registered
as a business on eBay, or as a Professional account on Cardmarket. The eBay account shows a private
seller [O]. eBay's policy says a seller "must register as a business if, for example, they sell items
they have bought to resell", and business sellers "can't represent themselves as private individuals"
[V, https://www.ebay.co.uk/help/policies/selling-policies/business-sellers-policy?id=4710].

There is also a cost side, for Yu and an adviser. eBay's "Fees for private sellers" page says: "It's
now free for UK-based private sellers to sell on eBay ... You won't pay final value fees or
regulatory operating fees when your items sell" [V,
https://www.ebay.co.uk/help/selling/fees-credits-invoices/understanding-invoice?id=4822]. So
registering the account as a business adds fees the private account doesn't pay today: a 10.9%
final value fee, £0.30 or £0.40 per order, and a 0.35% regulatory operating fee, all quoted exclusive of VAT [V,
https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809]. On a £20
order that is £2.65 before VAT [I].

None of this says anything about why the account is set up as it is. There may be an ordinary
explanation, such as a personal account or a switch under way [U]. Whether this is the company's
account or Yu's own is [U]. Registering or converting either account is Yu's hand.

---

## M1. Business identity

### eBay business-seller information

Company facts were read at Companies House on 2026-10-22 [V]:
- the overview page,
  https://find-and-update.company-information.service.gov.uk/company/15680297;
- the certificate of incorporation in the filing history, which says "the situation of its
  registered office is in England and Wales" (saved capture, not filed).

eBay's form fields need a login and weren't seen [U]. Fit the lines to the fields.

```text
Cambridge TCG Limited
Registered in England and Wales, company number 15680297
Registered office: 60 Tottenham Court Road Suite 4583a, Fitzrovia, London, United Kingdom, W1T 2EW
VAT number: [VAT number]
Email: [contact email]
Phone: [business phone number]
Returns address: [returns address, if not the registered office]
```

Notes:
- **VAT number.** eBay: "It's mandatory that you display your VAT identification number on the eBay
  site in connection with your listings" [V, help 4650]. Yu didn't give the number, and these docs
  don't record it. eBay also asks that the business name match the tax authority's records [V,
  help 4650]. Does HMRC's record read "Cambridge TCG Limited"? [U]
- **Phone.** eBay asks for "Full contact details for the business" [V, help 4710]. Whether a phone
  number is required is [U]. If Yu doesn't want one shown, check the form.
- **Email domain.** An address at the website's domain names the website, which ASSETS M rule 1
  keeps off both platforms. eBay's no-links rule exempts legally required information, so it is
  probably fine in this panel [I]; on Cardmarket it is unclear [U]. An address on another domain
  avoids the question. Yu chooses.
- **Address.** The registered office reads like a serviced or virtual office [I, vat.md §1]. Returns
  should go where the cards are packed: the listing says "Located in: Cambridge, United Kingdom"
  [O]. Hence the separate returns line.

### Cardmarket imprint (the top of About Us)

```text
Imprint
Cambridge TCG Limited
Registered office: 60 Tottenham Court Road Suite 4583a, Fitzrovia, London, United Kingdom, W1T 2EW
Registered in England and Wales, company number 15680297
VAT number: [VAT number]
Contact: [contact email]. For orders, please message us on Cardmarket.
```

- No Cardmarket page read on 2026-10-22 requires a UK seller's VAT ID on the profile [V, vat.md §4].
  Putting it in the imprint is the careful reading (Electronic Commerce Regulations 2002 reg.
  6(1)(g)) [I].
- German-style imprints also name a managing director. Leave that out unless Yu or the solicitor
  wants it [I].

### eBay returns policy

**Settings** (agents' proposal) [I]:
- Returns accepted: yes.
- Return period: 14 days, the legal minimum, or 30 days. Yu chooses, and the policy text below
  repeats the choice.
- Return postage: paid by the seller. eBay's policy says business sellers can't "Charge buyers
  return shipping fees" [V, help 4710].
- No restocking fee.

**Policy text:**

```text
Returns

Changed your mind? You can cancel within [14 or 30, the same as the return period setting] days of the day you receive your item. Start a return on eBay or send us a message. Then post the item back within 14 days of telling us.

We pay for return postage. We refund the price and the original postage within 14 days of getting the item back, or of seeing proof that you posted it, if that is sooner. There is no restocking fee.

Please send the card back as it arrived, in its sleeve and toploader. If it comes back in worse condition because it was handled more than needed to check it, we may take the loss in value off the refund.

Faulty or not as described? Tell us within 30 days of delivery for a full refund.

Your legal rights are not affected.
```

**What the notes change or flag:**
- **"No returns accepted"** is on the one listing read [O]. A business account needs a returns policy
  [V, help 4710], and the 14-day right exists by law regardless (CCR reg. 30(3): "14 days after
  the day on which the goods come into the physical possession of" the consumer) [V,
  https://www.legislation.gov.uk/uksi/2013/3134/regulation/30].
- **Return postage.** eBay is stricter than the law here. CCR reg. 35(5) lets a trader make the
  consumer pay return postage if it says so in advance
  [V, https://www.legislation.gov.uk/uksi/2013/3134/regulation/35]; eBay's business policy does
  not. So on eBay we pay.
- **Sources for the rest:**
  - 30 days for faulty items: eBay help 4710 [V].
  - The refund deadline (within 14 days of getting the item back, or of proof of posting if
    sooner) and the deduction for extra handling: CCR reg. 34, whose page didn't load on 2026-10-22
    [U]. eBay's own refund deadline wasn't read either [U]. Check both before pasting.
- **VAT doesn't change this text** [I]. A refund reduces the output VAT on that sale; the accountant
  handles that.

---

## M3. Title, condition and comment templates

### eBay title pattern

The pattern (ASSETS M3), at most 80 characters:

```text
[card name] [card number] [set, if not the number's own] [rarity or features] [language] One Piece Card Game [condition or grade]
```

Three worked examples. They are **illustrative**: they show the pattern, not real stock or real
grades.

| # | Title | Characters |
|---|---|---|
| 1 | `Monkey.D.Luffy OP05-119 Super Alternate Art Japanese One Piece Card Game PSA 10` | 79 |
| 2 | `Monkey.D.Luffy OP05-119 OP09 Wanted Poster SP Japanese One Piece Card Game NM` | 77 |
| 3 | `Kaido OP01-061 Leader Parallel English One Piece Card Game NM` | 61 |

(Counted with Python's `len()`.) Example 2 names OP09 because its card number, OP05-119, belongs to
another set. Example 3 names no set, because OP01-061 already says OP01.

House rules for titles [I, from ASSETS M3]:
- **One spelling per word:** "Japanese", never "JP", "Jap" or "JDM". All of these appear in the
  titles seen [O]; "JDM" is a car term and reads as an unrelated keyword [I].
- **No "!", and no "Mint".** One live title says "Mint" on a card whose item specifics say "Back
  scuffs/chips" [O]. Use NM or lower.
- **No other games' names and no unrelated characters as keywords**, and no "?" or comparisons.
- **Descriptions.** The one description read repeats the title [O]. Proposal: one line of condition
  notes per card ("Light whitening on two back corners; see photos 3–4").

### Condition mapping: eBay to and from Cardmarket

This mapping is an agents' proposal [I]: neither platform defines its scale against the other. The
sources are:
- eBay tiers: ASSETS M3, read 2026-10-20 [S]. The listing shows "Ungraded - Near mint or better"
  [O].
- Cardmarket grades: its Card Condition help page, https://help.cardmarket.com/en/CardCondition
  [V]. It lists Mint (M), Near Mint (NM), Excellent (EX), Good (GD), Light Played (LP), Played (PL)
  and Poor (PO), and gives the usual American equivalent for each grade below Mint.

When a card sits between two tiers, use the lower one on both sites.

| eBay condition | Cardmarket grade | Note |
|---|---|---|
| Ungraded: Near Mint or Better | NM | Cardmarket's M is "perfect condition; no excuses". Our rule is never Mint (ASSETS M3) |
| Ungraded: Lightly Played (Excellent) | EX | eBay's "Lightly Played" is Cardmarket EX, not Cardmarket LP. Cardmarket: EX's "American equivalent usually is Slightly Played or Lightly Played (not to be confused with the European Light Played)" |
| Ungraded: Moderately Played (Very good) | GD or LP | GD for strong wear from play; LP for heavier wear, still playable in a sleeve. Cardmarket gives GD's usual American equivalent as "Moderately Played" or "Very Good". eBay has no tier between them |
| Ungraded: Heavily Played (Poor) | PL or PO | Blackened, inked or tampered borders are always PO (Cardmarket) |
| Graded: grader, grade, optional certificate number | [U] | No Cardmarket rule for graded slabs was read. Don't list slabs there until it is |

### Cardmarket comments (simple English)

Comments never contradict the structured fields, never say "Mint", and carry no links (ASSETS M3).
Cardmarket's General Terms §7 add that the comment field "may not be used for your own or
third-party advertising purposes", and that contract terms don't belong in it [V].

```text
Light whitening on two back corners. See scan.
```

```text
Small scratch on the front foil, only visible in light. See scan.
```

```text
Slight off-centre front (about 60/40). See scan.
```

---

## M4. Cardmarket profile texts

Paste nothing here until the account is Professional. The General Terms §3 say a commercial user
must include "a correct and complete About Us, General Terms and Conditions, a Privacy Policy, and a
Withdrawal Form in your profile" [V, https://help.cardmarket.com/en/general-terms-and-conditions;
not among the bold upcoming changes].

On either platform: no hyperlinks, no URLs, and no mention of the website or the app (ASSETS M,
rule 1).

### About Us

```text
Cambridge TCG Limited is a UK company selling trading cards.

[Optional, once checked against the live stock: We sell mainly One Piece Card Game singles, many of them Japanese prints.]

[Imprint block from M1 goes here.]
```

- **The first sentence** is the ASSETS M4 entity sentence without "on eBay UK and Cardmarket". This
  is the same caution as on eBay below. Cardmarket's General Terms bar advertising in the comment
  field (§7) and using messages "for advertising your own or another's commercial services or
  merchandise" (§10) [V]. Its rule for profile text wasn't read [U], so naming eBay here stays out
  until it is.
- **Is it true?** The eBay account seen is registered as a private seller, and Cardmarket's profile
  wasn't seen. So the sentence stays unverified until both accounts are the company's [U].
- **The optional line** rests on eBay stock only: of 52 listings seen, all were One Piece and 37
  were titled Japanese, JP, Jap or Japan [O]. Cardmarket stock is [U].
- **eBay's About** already has a line [O]. If Yu wants it to name the company:

  ```text
  Cambridge TCG Limited is a UK company selling trading cards, mostly One Piece Card Game singles, many imported from Japan.
  ```

  This leaves out Cardmarket. eBay bans promoting outside sales sites in messages (RESEARCH §7.1),
  and its rule for the About text wasn't read [U]. It also drops "Minty": our rule avoids "Mint"
  words.

### Withdrawal policy and form

Cardmarket's own withdrawal button doesn't appear on UK-to-UK orders, but UK law still gives 14 days
(ASSETS M4). The policy below covers UK and EU consumers alike.

```text
Right of withdrawal

If you buy as a consumer, you can withdraw from your order without giving a reason. You have 14 days from the day you, or someone you name (not the carrier), receive the goods.

To withdraw, tell us clearly before the 14 days end. Send us a message on Cardmarket, or use the form below. Then post the goods back within 14 days of telling us, to: [returns address].

Return postage: [We pay for return postage. / You pay the direct cost of returning the goods.]

We refund the price and the original postage (up to the cost of the least expensive standard delivery we offer). We do this within 14 days of getting the goods back, or of seeing proof that you posted them, whichever is first. [How we refund, once checked: for example, "We refund through Cardmarket."]

Please send cards back as they arrived. If their condition got worse because they were handled more than needed to check them, we may take the loss in value off the refund.

Professional buyers have no right of withdrawal.
```

```text
Withdrawal form (fill in and send only if you want to withdraw)

To: Cambridge TCG Limited, [returns address], [contact email]

I/We hereby give notice that I/We cancel my/our contract of sale of the following goods:
[goods]
Ordered on / received on: [date]
Cardmarket order number: [order number]
Name: [name]
Address: [address]
Signature (only if sent on paper): [signature]
Date: [date]
```

- **Return postage is Yu's choice** on Cardmarket: CCR reg. 35(5) allows either, if the buyer is told
  in advance [V]. Using the same rule as eBay is simpler [I].
- **The wording follows CCR Schedule 3** (the model information and the model cancellation form) as
  we know it. A second session read Schedule 3 (the as-made PDF) on 2026-10-22 and found the
  wording follows it [V, 2026-10-22].
- **The postage cap** ("the least expensive standard delivery we offer") is the usual CCR rule for
  refunding postage: reg. 34 says "the least expensive common and generally acceptable kind of
  delivery", and a refund within 14 days of getting the goods back or of earlier proof they were
  sent (read by a second session) [V, 2026-10-22].
- **How refunds reach the buyer** on Cardmarket wasn't checked [U]. Hence the placeholder.

### General terms

```text
Terms of sale: Cambridge TCG Limited on Cardmarket

1. Who we are. Cambridge TCG Limited (see our imprint). These terms apply to what we sell on Cardmarket, together with Cardmarket's own General Terms and Conditions.
2. The contract. Your contract is with us, and it is made as Cardmarket's terms describe.
3. Prices. Every price includes any VAT that applies. Postage is extra and is shown before you pay.
4. Payment. Through Cardmarket only.
5. Dispatch. We post within [number] working days of payment, by the method you chose. Orders over [tracked-post threshold] go by tracked post, as Cardmarket requires.
6. Condition and language. We grade by Cardmarket's grading guide. When in doubt, we choose the lower grade. Where a scan is attached, it shows the card you get. Japanese cards are listed on their Asian-edition product pages.
7. Withdrawal. See our right of withdrawal and form.
8. Faulty, wrong or lost items. Tell us through Cardmarket messages. We put it right: a replacement where we have one, or a refund.
9. Invoices. [Wording depends on the VAT scheme the accountant confirms.]
10. Complaints. Message us on Cardmarket first. [Dispute resolution and governing law: wording for the solicitor.]

Your legal rights as a consumer are not affected.
```

- **Item 3** follows Cardmarket's General Terms §7: "The respective item price is the final price,
  including any applicable VAT. Shipping costs are not included in the item price." [V, vat.md §4]
- **Item 9.** If the margin scheme is used, invoices must not show VAT separately and must carry the
  words "margin scheme - second hand goods" [V, https://www.gov.uk/vat-margin-schemes; vat.md §5].
  Hence the placeholder.
- **Item 5.** The threshold was €25 when read on 2026-10-20 [S, RESEARCH §7.2]. Check it before
  pasting.

### Privacy notice (skeleton)

```text
Privacy notice

Who we are: Cambridge TCG Limited (see our imprint) decides how your data is used. Contact: [contact email], or a Cardmarket message. [ICO registration number, if registered.]

What we receive: when you buy from us, Cardmarket gives us [your name, delivery address, username and order details].

Why we use it: to post your order, and to deal with questions, returns and refunds. Our legal basis for this is our contract with you. We also keep the accounts and tax records the law requires; the basis for that is our legal obligation. We do not use your data for marketing.

Who we share it with: the postal service that delivers your order ([carrier]), [our accountant], and HMRC or other authorities when the law requires. We never sell it.

How long we keep it: order and tax records for [6 years]; messages for [period].

Where it is stored: [where, and any transfer outside the UK].

Your rights: you can ask to see, correct or delete your data, or object to how we use it. Message us. You can also complain to the Information Commissioner's Office (ICO).
```

- **"What we receive"** stays bracketed until Yu confirms what Cardmarket actually passes to sellers
  [U]. Add a line about payment details only once that is known.
- **"6 years"** matches HMRC's record-keeping periods quoted in vat.md [V, vat.md §4–5]. The
  accountant confirms it.

### Contact line

```text
Questions about an order? Send us a message on Cardmarket. We reply in English, usually within [24 hours] on working days.
```

---

## M6. Message templates (eBay and Cardmarket)

House rules (ASSETS M6):
- No contact details, URLs or off-platform offers.
- On Cardmarket, tracking goes through its messages and the order's tracking field.
- **Never mention feedback or evaluations** in any template, and above all not near an offer.

### Posted, with tracking

```text
Hello [buyer first name],

Your order [order number] was posted today by [carrier and service]. Tracking number: [tracking number].

[Cardmarket only: Please confirm arrival on Cardmarket when it arrives.]

Thank you,
[your name], Cambridge TCG
```

### A problem before dispatch

```text
Hello [buyer first name],

I'm sorry: [card name] from order [order number] [is not in the condition listed / could not be found / was damaged before posting].

You can choose:
- a refund for that card, and we post the rest of the order; or
- cancel the whole order, with a full refund.
[Or: a replacement, [description], with a scan attached.]

Please reply with your choice. We won't post anything until we hear from you.

[your name], Cambridge TCG
```

### Partial refund offer

```text
Hello [buyer first name],

Thank you for telling us about [card name]. You're right that it is [condition found], not [condition listed]. We're sorry.

We can refund [amount] now, and you keep the card. Or, if you prefer, send it back and we'll refund the full price and the postage. [Return postage: we pay.]

Please tell us which you'd like.

[your name], Cambridge TCG
```

- About 10% of the card's price is the usual Cardmarket figure for a one-grade dispute (ASSETS M6).
- The offer never depends on anything the buyer says or does about the sale.

### Reply to a withdrawal or return request

```text
Hello [buyer first name],

Thank you, we've received your cancellation for order [order number].

Please post [the item / the items] back within 14 days to: [returns address]. [eBay: use the return label eBay gives you; we pay the postage. / Cardmarket: return postage is paid by [us / you], as our withdrawal policy says.]

Please pack the cards as they arrived, in their sleeves and toploaders. We'll refund [amount, including the original postage] within 14 days of getting them back.

[your name], Cambridge TCG
```

---

## Before pasting (checklist for Yu)

1. Is each account the company's? Is it registered as a business (eBay) or Professional
   (Cardmarket)? M1 and M4 assume so.
2. Registering the eBay account as a business adds fees the private account doesn't pay today (see
   "One thing comes before the texts"). That is a question for Yu and an adviser.
3. Fill the placeholders: VAT number, contact email, phone, returns address, return period, dispatch
   days, reply time, the refund route, and Cardmarket's return-postage choice.
4. Open the live Cardmarket profile and compare. Replace existing texts rather than adding second
   copies.
5. Have the accountant confirm the VAT scheme, and so the invoice line in the terms.
6. A solicitor reads M1's returns, M4's withdrawal, terms and privacy texts.
7. Put each block through gates G1–G3 (and G4 for titles) before it goes out (README §5).
