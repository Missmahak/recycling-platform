import type { AppProps } from "next/app";
import { Montserrat } from "next/font/google";
import Head from "next/head";
import { toast, Toaster } from "sonner";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { getCategories } from "@/lib/getCategories";
import { getItems } from "@/lib/getItems";
import { useCallback, useEffect, useState } from "react";
import { auth, getCurrentUser, updateScore } from "@/lib/firebase";
import { useRouter } from "next/router";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useSound } from "use-sound";
import { TbCheck } from "react-icons/tb";
import { User } from "firebase/auth";

// Store
import { categoriesAtom } from "@/store/categories";
import { itemsAtom } from "@/store/items";
import { authAtom, IUser } from "@/store/auth";
import { scoresAtom } from "@/store/scores";

// Hooks
import useDebounce from "@/hooks/useDebounce";

// Styles
import "@/styles/tailwind.css";

// Components
import { Navbar } from "@/components/Navbar";
import { DroppableWoman } from "@/components/DroppableWoman";
import { getScores } from "@/lib/getScores";

const inter = Montserrat({
  subsets: ["latin"],
});

export default function App({ Component, pageProps }: AppProps) {
  const [, setScores] = useAtom(scoresAtom);
  const [category, setCategories] = useAtom(categoriesAtom);
  const [authCache, setAuth] = useAtom(authAtom);
  const [, setItems] = useAtom(itemsAtom);

  const { pathname } = useRouter();
  const [score, setScore] = useState(authCache.userDb?.score || 0);
  const debouncedScore = useDebounce(score, 1500);

  const [play] = useSound("/drop.mp3", {
    volume: 0.5,
  });

  /* Auth state change handlers */
  const onAuthStateChanged = useCallback(
    async (user: User | null) => {
      if (user && authCache.user?.uid !== user.uid) {
        const userDetails = await getCurrentUser();

        setScore(userDetails?.score || 0);

        setAuth({
          isAdmin: userDetails?.isAdmin || false,
          userDb: userDetails,
          user,
        });
      } else if (!user && authCache.user) {
        setScore(0);

        setAuth({
          isAdmin: false,
          user: null,
          userDb: null,
        });
      }
    },
    [authCache.user, setAuth]
  );

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(onAuthStateChanged);
    return () => unsubscribe();
  }, [onAuthStateChanged]);

  /* Fetch categories & scores */
  useEffect(() => {
    getScores().then((scores) => setScores(scores));

    getCategories().then((categories) =>
      setCategories((p) => ({
        ...p,
        categories,
      }))
    );
  }, [setCategories, setScores]);

  /* Fetch categoryitems */
  useEffect(() => {
    if (!category.selectedCategoryId) return;

    getItems(category.selectedCategoryId).then((items) =>
      setItems((p) => ({
        ...p,
        items,
      }))
    );
  }, [category.selectedCategoryId, setItems]);

  /* Update score */
  useEffect(() => {
    if (debouncedScore === 0 || authCache.userDb?.score === debouncedScore)
      return;

    updateScore(debouncedScore)
      .then(() => {
        setAuth((p) => ({
          ...p,
          userDb: {
            ...p.userDb,
            score: debouncedScore,
          } as IUser,
        }));
      })
      .catch(() =>
        toast.error("Something went wrong while saving your score!")
      );
  }, [authCache.userDb?.score, debouncedScore, setAuth]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;

    if (over?.id === "woman") {
      setScore((p) => p + 1);

      play();
      toast.success("You just recycled an item! 🎉", {
        icon: <TbCheck className="text-lg text-green-600" />,
      });
    }
  };

  return (
    <>
      <Head>
        <title>Recycling App</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover"
        />
      </Head>

      <Navbar fontFamily={inter.className} />

      <DndContext onDragEnd={handleDragEnd}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{
              opacity: 0,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
            }}
            className={clsx(
              inter.className,
              "container mx-auto  px-4 pb-10 md:w-11/12 md:px-0"
            )}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>

        <DroppableWoman />
      </DndContext>

      <Toaster position="bottom-left" />
    </>
  );
}
