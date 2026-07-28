import { FourTypesOfSoftwareCompanies } from "../data/postPreviews";
import { BlogShell } from "~/components/BlogShell";
import { ExternalLink } from "~/components/ExternalLink";
import { getSocialMeta } from "../data/siteMeta";

export function meta() {
  return [
    { title: FourTypesOfSoftwareCompanies.title },
    {
      name: "description",
      content: FourTypesOfSoftwareCompanies.previewText,
    },
    { property: "og:title", content: FourTypesOfSoftwareCompanies.title },
    {
      property: "og:description",
      content: FourTypesOfSoftwareCompanies.previewText,
    },
    { name: "twitter:title", content: FourTypesOfSoftwareCompanies.title },
    {
      name: "twitter:description",
      content: FourTypesOfSoftwareCompanies.previewText,
    },
    ...getSocialMeta(),
  ];
}

export default function FourTypesOfSoftwareCompaniesPost() {
  return (
    <BlogShell>
      <p>
        Code is free now. Okay, not literally. You still have to pay for your
        Cursor subscription, tokens, hosting, storage, bandwidth, and whatever
        else AWS managed to sneak onto your bill. But writing the code itself is
        no longer the hard part.
      </p>
      <p>
        I barely hand write code anymore. It&apos;s too slow for all of the
        things I want to build, and the code an agent writes is usually good
        enough. This matters because the original selling point of software was
        that it was expensive to build once and nearly free to distribute
        forever. Now the expensive part is getting cheaper too.
      </p>
      <p>
        Lately, indie hackers have been posting about lower traffic, revenue,
        and more churn. Pieter Levels said that &quot;BigAI is cannibalizing
        everything that used to be apps.&quot; Yaak&apos;s creator suspects AI
        is taking away its use cases, while businesses built through content and
        SEO are watching Google referrals fall. AI may not explain every bad
        month, but building is clearly getting easier while getting anybody to
        care is getting harder.
      </p>

      <h2>This happened fast</h2>
      <p>
        In 2023, AI-assisted coding still mostly felt like autocomplete, chat,
        and early experiments from tools like{" "}
        <ExternalLink href="https://cursor.com/blog/problems-2023">
          Cursor
        </ExternalLink>
        . It was useful, but I was still doing the work. In 2024, full IDEs
        dedicated to AI coding became good enough to use every day.
      </p>
      <p>
        In 2025, coding agents moved into the terminal.{" "}
        <ExternalLink href="https://www.anthropic.com/news/claude-3-7-sonnet">
          Claude Code
        </ExternalLink>{" "}
        arrived in February, Codex CLI followed in April, and Gemini CLI arrived
        in June. They could read a repository, edit files, and run tests, but I
        still needed to watch and review everything they did.
      </p>
      <p>
        <ExternalLink href="https://www.anthropic.com/news/claude-opus-4-5">
          Claude Opus 4.5
        </ExternalLink>{" "}
        came out on November 24, 2025, and that was the point where the models
        became noticeably better to me. They stayed on task longer, planned
        better, fixed more of their own mistakes, and started completing work
        instead of only producing code for me to finish.
      </p>
      <p>
        Now we have agents, subagents, and real background tasks. Tools like{" "}
        <ExternalLink href="https://docs.openclaw.ai/automation/tasks">
          OpenClaw
        </ExternalLink>{" "}
        can keep work running without waiting for you to stare at the terminal.
        As I write this, I have agents working across JCR, DBM, this website,
        Captures, and my 3D project at the same time. This is not autocomplete
        anymore. It is autonomous work.
      </p>
      <img
        loading="lazy"
        decoding="async"
        src="/ai-agent-projects.png"
        width="534"
        height="1326"
        alt="Codex project sidebar showing active tasks across JCR, DBM, josevalerio.com, Captures, and 3D projects"
        className="article-image--narrow"
      />

      <p>
        VCs used to ask, &quot;What if Google builds this?&quot; Now you have to
        ask, &quot;What if anybody builds this?&quot;
      </p>
      <p>
        I&apos;ve been trying to organize software companies into four levels.
        It&apos;s like the Kardashev scale for alien civilizations, except for
        software companies and named after me because why not. I don&apos;t know
        if this is a taxonomy, a durability scale, or something else. Don&apos;t
        think about it too hard.
      </p>

      <h2>Level 1: Wrappers</h2>
      <p>
        A Level 1 company takes your input, massages it a little, passes it to
        another service that does the real work, and returns the response.
        ChatGPT wrappers are the obvious example.
      </p>
      <p>
        My own{" "}
        <ExternalLink href="https://creditcardhoroscope.com">
          Credit Card Horoscope
        </ExternalLink>{" "}
        is a Level 1 product. We take your credit card information, charge you
        $1, send it to a model provider, and return a horoscope. OpenAI is
        probably never going to build Credit Card Horoscope. Not because they
        can&apos;t, but because the entire point is that it&apos;s a silly little
        thing that should exist.
      </p>
      <p>
        That is where I think Level 1 software ends up: fun, useful projects that
        can make real money, but not excellent long-term companies. A prominent
        AI lab may never want my silly horoscope generator, but it absolutely
        wants image generation, coding, research, and every other large use case
        people are building wrappers around.
      </p>
      <p>
        This is the Shark Tank &quot;This is a product, not a company&quot;
        category. A product is fine. Just don&apos;t confuse a temporary gap in
        somebody else&apos;s product with a moat.
      </p>

      <h2>Level 2: Products</h2>
      <p>
        Level 2 companies actually do something. An applicant tracking system is
        not just a form that forwards your resume somewhere. It has candidates,
        interviews, permissions, team settings, integrations, webhooks, reports,
        audit logs, and all of the annoying edge cases that show up after the
        first demo.
      </p>
      <p>
        <ExternalLink href="https://launchdarkly.com">
          LaunchDarkly
        </ExternalLink>{" "}
        does feature flags. <ExternalLink href="https://infisical.com">Infisical</ExternalLink>{" "}
        manages secrets. Dropbox syncs your files. They use other software and
        APIs underneath, because everything does, but they are the product the
        customer is actually buying.
      </p>
      <p>
        AI makes these companies easier to copy too, but copying the interface
        is not the same as replacing the company. The last 10% is permissions,
        migrations, reliability, support, security, and weird customer requests.
        Unfortunately, that last 10% is also most of the work.
      </p>

      <h2>Level 3: Ecosystems</h2>
      <p>
        A Level 2 company can expand into a suite. If you start with an ATS, you
        can add onboarding, payroll, benefits, and device management like{" "}
        <ExternalLink href="https://www.rippling.com">Rippling</ExternalLink>.
        You can keep going until you make{" "}
        <ExternalLink href="https://www.odoo.com">Odoo</ExternalLink> and sell
        software for basically every button a company could ever click.
      </p>
      <p>
        The biggest ones become ecosystems. Salesforce, Slack, Reddit, Discord,
        and the Bloomberg Terminal have enough weight that other companies,
        developers, communities, and entire careers form around them. Their moat
        is no longer just the code. It&apos;s everybody and everything already
        connected to it.
      </p>
      <p>
        Everybody wants to build their own Salesforce. Even with AI, almost
        nobody does. You can vibe code a CRM. You cannot vibe code decades of
        customer data, integrations, consultants, training, habits, and people
        whose job title is literally Salesforce Administrator.
      </p>

      <h2>Level 4: The real world</h2>
      <p>
        Level 4 companies cross the barrier between software and the real world.
        The barrier creates a moat by itself because reality is slow, expensive,
        regulated, and full of people who do not care that your demo worked.
      </p>
      <p>
        Stripe moves money.{" "}
        <ExternalLink href="https://robinhood.com/us/en/newsroom/introducing-clearing-by-robinhood/">
          Robinhood
        </ExternalLink>{" "}
        looks like a stock trading app, but underneath it are registered
        broker-dealers, clearing systems, market makers, banks, regulators, and
        compliance teams.{" "}
        <ExternalLink href="https://stockx.com">StockX</ExternalLink> moves and
        verifies physical goods. AWS and Google Cloud own data centers. Apple
        makes devices. Anduril makes hardware and sells it to governments.
        Palantir has relationships and deployments that are not an API call
        away. Tesla, SpaceX, and robotics companies probably fit here too, even
        if they are really hardware companies that also make software.
      </p>
      <p>
        AI can write software for a verification center. It cannot create the
        building, hire and train the authenticators, negotiate shipping rates,
        build relationships with brands, and earn trust from buyers and sellers.
        It can write a payment form. It cannot create bank relationships,
        licenses, compliance programs, and fraud operations.
      </p>

      <h2>You cannot bootstrap everything</h2>
      <p>
        This is the downside of moving up the scale. Credit Card Horoscope needs
        an API and a free weekend. A Level 2 product can start small and sell to
        customers before every feature is finished. A Level 3 company may have
        to spend ahead to attract enough users, integrations, and partners for
        the ecosystem to matter. At Level 3, capital buys time to reach critical
        mass.
      </p>
      <p>
        Level 4 can require lawyers, compliance teams, insurance, licenses,
        facilities, and regulatory capital before you are even allowed to serve
        the first customer. The same barrier that keeps competitors out also
        keeps you out. Some ideas will require VC or other outside capital just
        to exist. You can build on a licensed provider and rent the hard parts,
        but then that provider owns part of your moat and can eventually move
        into your product too.
      </p>

      <h2>Joe Schmoe is not building his own software</h2>
      <p>
        Most people do not want to build anything. Joe Schmoe would rather spend
        his summer partying in Miami than vibe code an applicant tracking
        system. Most people do not even pay $20 a month for AI, never mind spend
        $100,000 on hardware for &quot;infinite&quot; inference they will never
        use.
      </p>
      <p>
        X and Hacker News are a bubble. Pieter Levels cancelling his SaaS
        subscriptions and rebuilding them does not mean your accountant or
        dentist will do the same. People pay for convenience. They do not want
        to host, secure, fix, and maintain every tool they use.
      </p>
      <p>
        But Joe Schmoe does not have to build your competitor. One other person
        does. Or the AI lab you depend on adds your feature directly. Or an
        existing company adds it to the product your customer already pays for.
        The number of people capable of making software has exploded while the
        number of people willing to pay attention to it has not.
      </p>
      <p>
        This is why indie hackers are seeing the other side of the problem.
        Building the app is not enough. The hard part is marketing it, supporting
        it, and convincing somebody to care. If your internal tool is already
        90% of a SaaS product, finishing the remaining 10% may be easy. Getting
        customers still may not be worth the effort.
      </p>

      <h2>What happens to software engineers?</h2>
      <p>
        Not that long ago I thought being able to hand-write code set me apart.
        Now I barely do it. I&apos;ve used Codex to review pull requests, and
        most of its mistakes come from not knowing the business context behind a
        decision. It is not hard to imagine that context living in Slack,
        tickets, documents, and whatever the agent can read next.
      </p>
      <p>
        Does that mean companies need fewer engineers? Maybe. If one engineer
        can do five times as much, a company can build five times as much or hire
        one fifth of the people. I would like to pretend I know which one they
        will choose, but I do not.
      </p>
      <p>
        I do know that being the person who can type the code is not enough
        anymore. The valuable part is knowing what to build, catching when the
        generated answer is wrong, and owning it when it breaks. Context,
        judgment, relationships, and responsibility are harder to automate than
        syntax. For now.
      </p>
      <p>
        Code becoming free does not mean software disappears. It means the mere
        existence of your app is no longer impressive. The further your company
        gets from being only code, the harder it is for somebody to prompt your
        company into existence.
      </p>
      <p>
        So yes: if you&apos;re in slopware, pivot to hardware. Or at least move
        toward something real.
      </p>
    </BlogShell>
  );
}
