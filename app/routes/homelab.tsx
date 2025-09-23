import { ExternalLink } from "~/components/ExternalLink";
import { HomelabInit } from "../data/postPreviews";
import { BlogShell } from "~/components/BlogShell";
import { CodeSnippet } from "~/components/CodeSnippet";

export function meta() {
  return [
    { title: HomelabInit.title },
    { name: "description", content: HomelabInit.previewText },
  ];
}

export default function HomelabInitPage() {
  return (
    <BlogShell>
      <p className="">
        I've been keeping an eye on{" "}
        <ExternalLink href="https://basecamp.com/cloud-exit">
          Basecamp's cloud exit
        </ExternalLink>{" "}
        and{" "}
        <ExternalLink href="https://world.hey.com/dhh/we-have-left-the-cloud-251760fb">
          DHH's willingness to talk about it openly
        </ExternalLink>
        , the{" "}
        <ExternalLink href="https://world.hey.com/dhh/our-cloud-exit-savings-will-now-top-ten-million-over-five-years-c7d9b5bd">
          savings behind it
        </ExternalLink>
        , as well as{" "}
        <ExternalLink href="https://youtu.be/-cEn_83zRFw?t=1295">
          his crusade
        </ExternalLink>{" "}
        against PaaS vendors and the cloud in general. This blog is not about
        whether the cloud is good or bad, I only bring it up because his journey
        intrigued me to look into this topic which I put off for longer than I
        should have.
      </p>
      <p>
        I was born in 1998 so you could say I was late to the PC era a bit. My
        first memories of a PC where, of course, playing video games like Age of
        Empires and Little Fighter 2 with my brother. Fast forward 20 years and
        I write software for a living, I don't do much gaming anymore, and I
        have a blog now. My hopes of becoming a Counter Strike god died during
        college. At every company I've worked at, we've always deployed to AWS;
        nobody ever got fired for doing so. I got to skip the "host it from your
        dorm room" era of computing. I never got to work in a datacenter. You
        went to the cloud because thats what everyone does.
      </p>
      <p>
        AWS <em>IS</em> magic, however, it's expensive for exploration. At least
        if you wanted to do things The Right Way. For me, that meant setting up
        a "real" setup to match what a real company would have, even if it was
        completely impractical for my usecase. You'd need at least 3 nodes for
        redundancy, RDS to separate your DB.. and a load balancer of course. You
        obviously put things in a private subnet right? Well you're going to
        need a NAT Gateway, also we charge for IPv4s now.. also bandwith is not
        included.
      </p>
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
        <p className="text-yellow-800">
          The reason for this of course was that you could talk about it on your
          resume! Even if you had a startup that never got off the ground, you
          could talk about all the cool tech and architecture diagrams you
          dreamed up that never served a single request. Moving on...
        </p>
      </div>

      <p>
        That is why in recent years, I've always used{" "}
        <ExternalLink href="https://railway.com">Railway</ExternalLink> to host
        all of my projects. Railway has an amazing feaure where you only pay for
        what you <em>actually</em> use. If your pods use 1millicore and 2mb of
        ram, that is all you pay for. This means you can easily afford to{" "}
        <ExternalLink href="https://x.com/notjoswayski/status/1959399001263907159">
          host many apps for pennies
        </ExternalLink>{" "}
        depending on how efficient they are (Rust mentioned). This is incredibly
        attractive for a lot of the stuff we work on outside of work (which
        doesn't make money).
      </p>
      <p>TODO </p>
    </BlogShell>
  );
}
