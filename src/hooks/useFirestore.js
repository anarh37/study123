import { useState, useEffect, useRef } from 'react'; // useRef 추가
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useFirestore(uid, key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [isReady, setIsReady] = useState(false);
  const isPending = useRef(false); // 현재 저장 중인지 확인하는 깃발
  const timerRef = useRef(null);   // 디바운스 타이머 관리

  useEffect(() => {
    if (!uid) {
      setStoredValue(initialValue);
      setIsReady(true);
      return;
    }

    const docRef = doc(db, 'users', uid, 'plannerData', key);
    
    setIsReady(false);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      // 핵심 수정: 내가 저장 중(isPending)일 때는 서버 데이터를 무시합니다.
      if (docSnap.exists() && !isPending.current) {
        setStoredValue(docSnap.data().value);
      } else if (!docSnap.exists() && !isPending.current) {
        setStoredValue(initialValue);
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, [uid, key]);

  const setValue = async (value) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    
    // 1. 화면(로컬 상태)에 즉시 반영
    setStoredValue(valueToStore);
    isPending.current = true; 

    // 2. 디바운스 처리 (500ms 정도가 적당합니다)
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(async () => {
      if (uid) {
        try {
          const docRef = doc(db, 'users', uid, 'plannerData', key);
          await setDoc(docRef, { value: valueToStore }, { merge: true });
          // 3. 서버 저장이 완료되면 다시 동기화 허용
          isPending.current = false;
        } catch (error) {
          console.error("Firestore save error:", error);
          isPending.current = false;
        }
      }
    }, 500); // 2000ms는 너무 길어서 500ms로 조정했습니다.
  };

  return [storedValue, setValue, isReady];
}
