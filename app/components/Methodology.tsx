// The method, written out in full on the How it works page. Kept as data so
// the advisory-wording scan reads it like any other UI text.

export const METHOD: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "replay",
    title: "How the replay works",
    body: (
      <>
        <p>
          Your plan has a length: the days from your start date to your
          deadline. SpotCheck takes every day in the rate history since 1999 as
          a possible start, runs each strategy over the same number of days from
          there, and records what it would have cost.
        </p>
        <p>
          A conversion scheduled on a day with no published rate uses the next
          available rate. Decisions (like whether the target was reached) only
          ever look at rates up to that day, never later ones.
        </p>
      </>
    ),
  },
  {
    id: "rescaling",
    title: "Why the costs are rescaled to today's rate",
    body: (
      <p>
        A window starting in 1999 at 1.70 SGD per USD isn&apos;t comparable with
        one starting today at around 1.30. So each window&apos;s cost is divided
        by the rate on its own start date, then multiplied by your amount and
        today&apos;s rate. Every outcome then reads: &ldquo;if the coming months
        move the way that window did, this is what you&apos;d pay&rdquo;.
        That&apos;s also why converting everything at once has no range: you
        know today&apos;s rate.
      </p>
    ),
  },
  {
    id: "trends",
    title: "Long trends in the history",
    body: (
      <p>
        The history includes long trends, such as the Singapore dollar
        strengthening against the US dollar for much of 2004–2013. Any strategy
        that converts later benefits from a trend like that in the replay. A
        trend in the past says nothing about the direction of the next few
        months.
      </p>
    ),
  },
  {
    id: "overlap",
    title: "Overlapping windows",
    body: (
      <p>
        Windows that start a day apart share almost all their days, so thousands
        of windows contain far fewer truly separate histories. The percentages
        describe this one history; they are not probabilities of what will
        happen next.
      </p>
    ),
  },
  {
    id: "sources",
    title: "Where the rates come from",
    body: (
      <>
        <p>
          Each currency uses one source for its whole history, so there are no
          jumps where sources switch. For the 27 currencies the European Central
          Bank has published every working day since 1999 or January 2000
          (including USD, EUR, GBP, JPY, AUD, CNY and INR), SpotCheck uses the
          ECB euro reference rates and derives each SGD rate as (SGD per EUR) ÷
          (currency per EUR), both fixed at the same moment each day. The other
          12 use Frankfurter&apos;s blended central-bank rates, which average
          sources that fix at different times of day; that smooths daily moves,
          so daily volatility from them is understated.
        </p>
        <p>
          Only Monday–Friday trading observations are used. These are mid-market
          reference rates: banks, cards and money changers charge more, and the
          spread input adds that cost to every conversion.
        </p>
      </>
    ),
  },
  {
    id: "limits",
    title: "What this tool doesn't do",
    body: (
      <p>
        It doesn&apos;t predict rates or tell you what to do. It shows how
        simple approaches would have worked out in the past, so you can see the
        trade-off between a lower average and a narrower range of outcomes.
      </p>
    ),
  },
];
