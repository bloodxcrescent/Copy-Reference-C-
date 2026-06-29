using UnityEngine;

namespace Game.Battle
{
    public class BattleResult : MonoBehaviour
    {
        public int HeroId { get; set; }
        private int heroId;

        private void BuildRoundStats(int heroId)
        {
            int damage = 0;
            int roundIndex = 0;
            Debug.Log(heroId + damage + roundIndex + this.heroId + HeroId);
        }

        private void OnBattleFinish()
        {
            Debug.Log("done");
        }
    }
}
