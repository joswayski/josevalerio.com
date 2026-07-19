import { NoFunAllowed } from "../data/postPreviews";
import { BlogShell } from "~/components/BlogShell";
import { ExternalLink } from "~/components/ExternalLink";
import { getSocialMeta } from "../data/siteMeta";

export function meta() {
    return [
        { title: NoFunAllowed.title },
        { name: "description", content: NoFunAllowed.previewText },
        { property: "og:title", content: NoFunAllowed.title },
        { property: "og:description", content: NoFunAllowed.previewText },
        { name: "twitter:title", content: NoFunAllowed.title },
        { name: "twitter:description", content: NoFunAllowed.previewText },
        ...getSocialMeta(),
    ];
}

export default function NoFunAllowedPost() {


    return (
        <BlogShell>
            <p className="">
                Video games aren't fun anymore.. At least Battlefield 6 isn't. I turned 27 this year so maybe I'm just a boomer or an Unc at this point (Hi Delia!) so feel free to dismiss everything you read from here on out.
            </p>
            <p>I've recently been playing a lot of <ExternalLink href="https://www.ea.com/games/battlefield/battlefield-6">Battlefield 6</ExternalLink> with my brother and I'm especially frustrated at all of the things that are being done to make the game "balanced" which take away at the core of the game.
            </p>
            <p>I will admit, I have a soft spot for Bad Company 2. But here's an example of what I'm talking about:</p>
                <p>Snipers are not a one shot kill at close ranges. This robs us of moments like <ExternalLink href="https://www.youtube.com/watch?v=dFMIE4Mg4mg">Sgt. Enigma's Aggressive Recon</ExternalLink> clips, so unless you headshot someone you are not getting that kill. Skill issue, sure, but why can I do it with a shotgun + slugs and not a sniper rifle? Also guess what they decided this year? Every class can be recon. There is no "class lock" and if you want to be an engineer with a sniper rifle, they are not going to stop that because selling skins is what is important. That leads to my next point...</p> 
 <p>Everyone is an engineer. Forget that flying air vehicles in this game feels floaty, everybody and I mean everyone uses an engineer to get a rocket launcher (because let's face it, assault sucks and there's no reason to be support in Conquest, the only <span className="italic">real</span> game mode) to shoot you down. That means that as soon as you spawn, you're getting locked on either by the AA or the 50 players that are rocking an engineer class to nuke you. Have fun with your one set of flares every 10 seconds.</p>
        <p>
            You can't stack mines on top of each other. What the hell? You have to spread them out now because god forbid someone steps on one mine thinking it's one when it's actually three and they die, that wouldn't be fun.
        Just use the other mines you say? Same problem, plus half the time they don't detonate! Because obviously the ones that detonate at a  distance or through sound or whatever the fuck mechanic would be much better than the ones you have to physically step on.. you know what that means... NERFED.</p>
        <p>No cirlce strafing. Remember what I said about air vehicles feeling floaty? You can't do <ExternalLink href="https://www.youtube.com/watch?v=CzD9WqwHMyg&t=79s">this</ExternalLink> anymore because that wouldn't be balanced, even with the 50 rocket launchers against you apparently. Don't forget the limited ammo! Make sure you go back to base to refill your ammo, otherwise it's not balanced.</p>
        <p>Wait hold on - you hit a helo with a rocket launcher? Takes two hits now but you will knock them off balance for a bit and take half their health. Don't worry, just shoot again in 3 seconds LMAO</p>

        <p>Remember charging up your defibrillator and getting kills with it? Gone. Takes two hits now.</p>
        <p>Spawn beacon? We have to make sure it gets destroyed when you use it so that.. you place another one down again.. otherwise there's no drawback! Not balanced!</p>
        
        <p>Mortar? Did you really think you were going to be able to kill someone with this thing? Nerfed!</p>
        <p>Here are 47 different grips for the gun you're not sure you like: one slightly improves draw speed but slightly reduces ADS accuracy, another one moderately improves draw speed but moderately reduces ADS accuracy, a third one significantly improves draw speed but significantly reduces ADS accuracy, then there's one that slightly improves draw speed but moderately reduces ADS accuracy while moving, and another that moderately improves draw speed but slightly reduces ADS accuracy while hip firing, and don't forget the one that significantly improves draw speed but now your character has developed carpal tunnel syndrome. But wait, maybe you want ADS accuracy instead? Here's one that slightly improves ADS accuracy but slightly reduces draw speed, one that moderately improves ADS accuracy but moderately reduces draw speed, one that significantly improves ADS accuracy but significantly reduces draw speed, one that slightly improves ADS accuracy while moving but reduces ADS accuracy while stationary because that makes sense, and one that moderately improves ADS accuracy while prone but reduces ADS accuracy while standing because god forbid you have both. Oh, you wanted recoil control? Here's one that slightly reduces recoil but slightly increases draw time, one that moderately reduces recoil but moderately increases ADS time, one that significantly reduces recoil but significantly reduces hip fire accuracy, one that slightly reduces vertical recoil but slightly increases horizontal recoil, and one that moderately reduces horizontal recoil but moderately increases vertical recoil because we couldn't just have one grip that reduces recoil. And for the mounting enthusiasts: one that slightly improves mounting on edges but reduces ADS accuracy, one that moderately improves mounting while prone but increases draw time, one that significantly improves mounting effectiveness but only works on ledges that are the exact height of your character's belly button, and one that slightly improves mounting speed but moderately reduces your will to live after reading all of these descriptions.</p>
   
        <p>MCOM damage? Gone. Sure it's not a new BF6 thing, but it's in the spirit of removing fun from the game.</p>
        <p>There are so many of these tiny little things that are getting stripped away from this game to make it "balanced" that it's not fun anymore. Bad Company 2 was the first game I ever owned on an Xbox 360 and I loved it. I only got it because Gamestop ran out of Black Ops CDs, so I settled for BC2. The magic of that game is gone. In the next 50 years I'll eventually make my own game.. you'll see.</p>
        </BlogShell>
    );
}
